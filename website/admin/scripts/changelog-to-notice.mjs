#!/usr/bin/env node
/**
 * NOTICE-01 — Build a Mission Control notice draft from CHANGELOG.md.
 *
 *   node website/admin/scripts/changelog-to-notice.mjs --tag v1.0.3
 *   node website/admin/scripts/changelog-to-notice.mjs --tag unreleased --pretty
 *   node website/admin/scripts/changelog-to-notice.mjs --tag v1.0.3 --save --api https://cursor-dev.lorapok.tech
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNoticeDraftFromChangelog } from "../functions/api/_shared/changelog-notice.js";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(adminDir, "../..");

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ tag?: string; pretty?: boolean; save?: boolean; api?: string; token?: string }} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--pretty") out.pretty = true;
    else if (arg === "--save") out.save = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--tag" && argv[i + 1]) out.tag = argv[++i];
    else if (arg.startsWith("--tag=")) out.tag = arg.slice("--tag=".length);
    else if (arg === "--api" && argv[i + 1]) out.api = argv[++i];
    else if (arg.startsWith("--api=")) out.api = arg.slice("--api=".length);
    else if (arg === "--token" && argv[i + 1]) out.token = argv[++i];
    else if (arg.startsWith("--token=")) out.token = arg.slice("--token=".length);
  }
  return out;
}

function usage() {
  console.log(`Usage: changelog-to-notice.mjs --tag <version|unreleased> [--pretty] [--save --api URL [--token JWT]]`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.tag) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const markdown = readFileSync(resolve(repoRoot, "CHANGELOG.md"), "utf8");
  const draft = buildNoticeDraftFromChangelog(markdown, args.tag);

  if (args.save) {
    const apiBase = (args.api ?? process.env.ADMIN_API_BASE ?? "http://localhost:5173").replace(/\/$/, "");
    const token = args.token ?? process.env.ADMIN_ID_TOKEN;
    if (!token) {
      console.error("Missing auth token. Set ADMIN_ID_TOKEN or pass --token.");
      process.exit(1);
    }
    const res = await fetch(`${apiBase}/api/notices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(draft),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(data.error ?? `Save failed (${res.status})`);
      process.exit(1);
    }
    console.log(JSON.stringify({ ok: true, id: data.notice?.id ?? draft.id }, null, args.pretty ? 2 : 0));
    return;
  }

  const output = args.pretty ? JSON.stringify(draft, null, 2) : JSON.stringify(draft);
  console.log(output);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
