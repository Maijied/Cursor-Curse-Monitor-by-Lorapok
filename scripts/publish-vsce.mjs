#!/usr/bin/env node
/**
 * Publish a VSIX to the VS Code Marketplace with retries for transient Azure 503s.
 *
 * Marketplace occasionally returns HTML "Service Unavailable" / HTTP 503 mid-publish;
 * a bare `vsce publish` fails the whole deploy job. This wrapper retries those cases
 * and treats "already exists / already published" as success.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string} output
 */
export function isAlreadyPublished(output) {
  return /already exists|already published/i.test(output);
}

/**
 * @param {string} output
 */
export function isTransientMarketplaceError(output) {
  return (
    /service unavailable|http error 503|<\s*!DOCTYPE html/i.test(output) ||
    /\b(502|503|504)\b|gateway timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|temporarily unavailable/i.test(
      output
    )
  );
}

/**
 * @param {number} ms
 */
function sleepMs(ms) {
  spawnSync("sleep", [String(Math.max(1, Math.ceil(ms / 1000)))], { stdio: "ignore" });
}

/**
 * @param {string[]} argv
 */
export function parsePublishVsceArgs(argv) {
  /** @type {{ preRelease: boolean; vsix: string | null; attempts: number; dryRun: boolean }} */
  const opts = { preRelease: false, vsix: null, attempts: 6, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--pre-release") opts.preRelease = true;
    else if (arg === "--vsix" && argv[i + 1]) opts.vsix = argv[++i];
    else if (arg === "--attempts" && argv[i + 1]) opts.attempts = Math.max(1, Number(argv[++i]) || 6);
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "-h" || arg === "--help") {
      console.log(`Usage: node scripts/publish-vsce.mjs [options]

Options:
  --vsix <path>     VSIX to publish (default: newest *.vsix in repo root)
  --pre-release     Pass --pre-release to vsce
  --attempts <n>    Retry count for transient 503/5xx (default 6)
  --dry-run         Resolve VSIX and print plan only

Env: VSCE_PAT (required)
`);
      process.exit(0);
    }
  }
  return opts;
}

/**
 * @param {string} [cwd]
 */
export function resolveNewestVsix(cwd = root) {
  const files = readdirSync(cwd)
    .filter((f) => f.endsWith(".vsix"))
    .map((f) => {
      try {
        return { f, t: statSync(resolve(cwd, f)).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.t - a.t);
  return files[0] ? resolve(cwd, files[0].f) : null;
}

/**
 * @param {{ vsix: string; preRelease?: boolean; attempts?: number; token?: string }} opts
 */
export function publishVsceWithRetries(opts) {
  const token = (opts.token ?? process.env.VSCE_PAT ?? "").trim();
  if (!token) {
    return { ok: false, error: "VSCE_PAT is not set" };
  }
  const vsix = opts.vsix;
  if (!vsix) {
    return { ok: false, error: "No VSIX path provided" };
  }

  const attempts = opts.attempts ?? 6;
  const args = ["vsce", "publish", "--packagePath", vsix, "-p", token];
  if (opts.preRelease) args.push("--pre-release");

  let lastOutput = "";
  for (let i = 1; i <= attempts; i++) {
    console.log(`Publishing ${vsix} (attempt ${i}/${attempts})…`);
    const result = spawnSync("npx", args, {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, VSCE_PAT: token },
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    lastOutput = output;
    if (output.trim()) console.log(output.trim());

    if (result.status === 0) {
      return { ok: true, output, attempt: i };
    }
    if (isAlreadyPublished(output)) {
      console.warn("::warning::VS Code Marketplace already has this version — OK");
      return { ok: true, output, attempt: i, alreadyPublished: true };
    }

    const transient = isTransientMarketplaceError(output);
    console.warn(`vsce publish failed (exit ${result.status}): ${output.slice(0, 400)}`);
    if (!transient || i === attempts) {
      return {
        ok: false,
        error: transient
          ? `VS Code Marketplace still unavailable after ${attempts} attempts`
          : output.trim().slice(0, 800) || `vsce publish failed (${result.status})`,
        output,
        attempt: i,
        transient,
      };
    }
    const wait = Math.min(90_000, 10_000 * i);
    console.warn(`::warning::Transient Marketplace 5xx — retrying in ${Math.round(wait / 1000)}s…`);
    sleepMs(wait);
  }

  return { ok: false, error: lastOutput.trim().slice(0, 800) || "vsce publish failed", output: lastOutput };
}

async function main() {
  const opts = parsePublishVsceArgs(process.argv);
  const vsix = opts.vsix ? resolve(opts.vsix) : resolveNewestVsix();
  if (!vsix) {
    console.error("::error::No .vsix found in repo root");
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log(
      JSON.stringify({
        vsix,
        preRelease: opts.preRelease,
        attempts: opts.attempts,
        tokenSet: Boolean(process.env.VSCE_PAT?.trim()),
      })
    );
    return;
  }

  const result = publishVsceWithRetries({
    vsix,
    preRelease: opts.preRelease,
    attempts: opts.attempts,
  });
  if (!result.ok) {
    console.error(`::error::${result.error}`);
    process.exit(1);
  }
  console.log(`::notice::VS Code Marketplace publish OK${result.alreadyPublished ? " (already published)" : ""}`);
}

const isCli = process.argv[1]?.endsWith("publish-vsce.mjs");
if (isCli) {
  main().catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });
}
