#!/usr/bin/env node
/**
 * Publish to Open VSX under the canonical lorapok-labs namespace.
 *
 * package.json uses publisher "LorapokLabs" for VS Code Marketplace. We temporarily
 * patch publisher and re-run `vsce package` so Open VSX receives a valid VSIX
 * (manual zip repack is rejected for harmful extra fields).
 */
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const OVSX_PUBLISHER = "lorapok-labs";
const VSCE_PUBLISHER = "LorapokLabs";
const EXT_NAME = pkg.name;

function parseArgs(argv) {
  const args = { dryRun: false, preRelease: false, vsix: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--pre-release") args.preRelease = true;
    else if (arg === "--vsix" && argv[i + 1]) args.vsix = argv[++i];
    else if (arg === "-h" || arg === "--help") {
      console.log(`Usage: node scripts/publish-ovsx.mjs [options]

Options:
  --pre-release     Pass --pre-release to ovsx publish
  --dry-run         Package with lorapok-labs publisher and validate only
`);
      process.exit(0);
    }
  }
  return args;
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: opts.inherit ? "inherit" : "pipe",
    encoding: "utf8",
    cwd: opts.cwd ?? root,
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    const stdout = result.stdout?.trim() ?? "";
    throw new Error(
      `${cmd} ${args.join(" ")} failed (${result.status})${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ""}`
    );
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function validateVsixSharedBundle(vsixPath) {
  const listing = run("unzip", ["-Z1", vsixPath])
    .split("\n")
    .filter(Boolean);
  const sharedEntry = "extension/vendor/cursor-monitor-shared/dist/index.js";
  if (!listing.includes(sharedEntry)) {
    throw new Error(
      `VSIX missing ${sharedEntry}. Ensure vscode:prepublish ran (compile + stage-shared-for-vsix) and use --no-dependencies.`
    );
  }
  if (listing.some((line) => line.startsWith("extension/node_modules/"))) {
    throw new Error("VSIX must not bundle node_modules — use --no-dependencies with vendor/cursor-monitor-shared.");
  }
}

function packageForOvsxPublisher(workDir) {
  const originalPkg = readFileSync(pkgPath, "utf8");
  const patched = { ...JSON.parse(originalPkg), publisher: OVSX_PUBLISHER };
  const outVsix = join(workDir, `${EXT_NAME}-${patched.version}-ovsx.vsix`);

  writeFileSync(pkgPath, JSON.stringify(patched, null, 2) + "\n");
  try {
    run("npx", [
      "vsce",
      "package",
      "-o",
      outVsix,
      "--allow-missing-repository",
      "--no-dependencies",
    ], { inherit: true });
    validateVsixSharedBundle(outVsix);
  } finally {
    writeFileSync(pkgPath, originalPkg);
  }

  const restored = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (restored.publisher !== VSCE_PUBLISHER) {
    throw new Error(`Failed to restore package.json publisher to ${VSCE_PUBLISHER}`);
  }

  return { outVsix, version: patched.version };
}

function validateVsixPublisher(vsixPath) {
  const xml = run("unzip", ["-p", vsixPath, "extension.vsixmanifest"]);
  if (!xml.includes(`Publisher="${OVSX_PUBLISHER}"`)) {
    throw new Error(`VSIX manifest publisher is not ${OVSX_PUBLISHER}`);
  }
  const pkgJson = run("unzip", ["-p", vsixPath, "extension/package.json"]);
  const inner = JSON.parse(pkgJson);
  if (inner.publisher !== OVSX_PUBLISHER) {
    throw new Error(`VSIX package.json publisher is not ${OVSX_PUBLISHER}`);
  }
}

async function fetchCanonicalLatest() {
  const res = await fetch(`https://open-vsx.org/api/${OVSX_PUBLISHER}/${EXT_NAME}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.version?.replace(/^v/, "") ?? null;
}

async function waitForCanonicalVersion(target, attempts = 36, delayMs = 10000) {
  for (let i = 0; i < attempts; i++) {
    const latest = await fetchCanonicalLatest();
    if (latest === target) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

function publishVsix(vsixPath, preRelease) {
  const token = process.env.OVSX_PAT;
  if (!token) throw new Error("OVSX_PAT is not set");

  const nsResult = spawnSync("npx", ["ovsx", "create-namespace", OVSX_PUBLISHER, "-p", token], {
    encoding: "utf8",
  });
  const nsOutput = `${nsResult.stdout ?? ""}${nsResult.stderr ?? ""}`;
  if (nsResult.status !== 0 && !/already exists/i.test(nsOutput)) {
    throw new Error(`create-namespace failed: ${nsOutput.trim() || nsResult.status}`);
  }

  const publishArgs = ["ovsx", "publish", "-i", vsixPath, "-p", token];
  if (preRelease) publishArgs.push("--pre-release");

  const maxAttempts = 3;
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = spawnSync("npx", publishArgs, { encoding: "utf8" });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (result.status === 0) return output;
    if (/already published/i.test(output)) {
      console.warn("::warning::Version already on Open VSX — treating as success");
      return output;
    }
    lastError = output.trim() || `ovsx publish failed (${result.status})`;
    const retryable = /504|gateway timeout|502|503|ETIMEDOUT|ECONNRESET/i.test(output);
    if (!retryable || attempt === maxAttempts) break;
    const waitMs = attempt * 15000;
    console.warn(`::warning::Open VSX publish attempt ${attempt} failed (${lastError.slice(0, 120)}). Retrying in ${waitMs / 1000}s…`);
    spawnSync("sleep", [`${waitMs / 1000}`]);
  }
  throw new Error(lastError);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workDir = mkdtempSync(join(tmpdir(), "ovsx-package-"));

  console.log(`Root package publisher (VS Code): ${pkg.publisher}`);
  console.log(`Target Open VSX publisher: ${OVSX_PUBLISHER}`);
  console.log(`Package version: ${pkg.version}`);

  try {
    const { outVsix, version } = packageForOvsxPublisher(workDir);
    validateVsixPublisher(outVsix);
    console.log(`Built Open VSX VSIX: ${outVsix}`);

    if (args.dryRun) {
      console.log("Dry run OK — vsce package with lorapok-labs publisher.");
      return;
    }

    const target = version.replace(/^v/, "");
    const canonicalLatest = await fetchCanonicalLatest();
    if (canonicalLatest === target) {
      console.warn(`::warning::Version ${target} is already live on Open VSX (${OVSX_PUBLISHER}) — skipping publish`);
      return;
    }

    const dupRes = await fetch(`https://open-vsx.org/api/${VSCE_PUBLISHER}/${EXT_NAME}`, {
      headers: { Accept: "application/json" },
    });
    const duplicateVersion = dupRes.ok
      ? (await dupRes.json())?.version?.replace(/^v/, "") ?? null
      : null;

    if (duplicateVersion === target) {
      console.warn(
        `::warning::Version ${target} also exists on duplicate namespace ${VSCE_PUBLISHER}. ` +
          `Publishing to ${OVSX_PUBLISHER} anyway (Open VSX may delay indexing).`
      );
    }

    const before = await fetchCanonicalLatest();
    const output = publishVsix(outVsix, args.preRelease);
    if (output) process.stdout.write(output);

    const published = await waitForCanonicalVersion(target);
    if (published) {
      console.log(`Published ${target} to Open VSX namespace ${OVSX_PUBLISHER}`);
      return;
    }

    const after = await fetchCanonicalLatest();
    if (after === target) {
      console.log(`Published ${target} to Open VSX namespace ${OVSX_PUBLISHER}`);
      return;
    }

    if (/Published/i.test(output)) {
      console.warn(
        `::warning::ovsx CLI reported success but ${OVSX_PUBLISHER} API still shows ` +
          `${after ?? "missing"} (expected ${target}). Open VSX indexing may be delayed; ` +
          `verify-marketplace-sync will re-check.`
      );
      return;
    }

    throw new Error(
      `Publish command finished but ${target} not found on ${OVSX_PUBLISHER} ` +
        `(before=${before ?? "none"}, after=${after ?? "none"}). Output: ${output.slice(0, 400)}`
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
