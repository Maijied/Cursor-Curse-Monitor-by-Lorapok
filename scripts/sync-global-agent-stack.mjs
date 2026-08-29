#!/usr/bin/env node
/**
 * Sync Lorapok global agent skills from this repo into IDE skill directories.
 * Installs itself to ~/.local/bin/sync-global-agent-stack when run from the repo.
 *
 * Usage:
 *   node scripts/sync-global-agent-stack.mjs
 *   ~/.local/bin/sync-global-agent-stack
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(repoRoot, ".agents", "skills");

/** Skills documented as global in AGENTS.md / docs/wiki/Home.md */
const GLOBAL_SKILLS = [
  "loragent-amo-publish",
  "loragent-dynamic-versioning",
  "loragent-cloudflare-mail-master",
  "secure-cred-vault",
];

const TARGET_ROOTS = [
  join(homedir(), ".cursor", "skills"),
  join(homedir(), ".agents", "skills"),
  join(homedir(), ".claude", "skills"),
];

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
}

function installSelf() {
  const binDir = join(homedir(), ".local", "bin");
  const dest = join(binDir, "sync-global-agent-stack");
  mkdirSync(binDir, { recursive: true });

  const script = `#!/usr/bin/env bash
set -euo pipefail
exec node "${join(repoRoot, "scripts", "sync-global-agent-stack.mjs")}" "$@"
`;
  writeFileSync(dest, script, { mode: 0o755 });
  chmodSync(dest, 0o755);
  return dest;
}

function main() {
  if (!existsSync(sourceRoot)) {
    console.error(`missing skill source: ${sourceRoot}`);
    process.exit(1);
  }

  const synced = [];
  const missing = [];

  for (const name of GLOBAL_SKILLS) {
    const src = join(sourceRoot, name);
    if (!existsSync(join(src, "SKILL.md"))) {
      missing.push(name);
      continue;
    }
    for (const root of TARGET_ROOTS) {
      copyDir(src, join(root, name));
    }
    synced.push(name);
  }

  const binPath = installSelf();

  console.log("Lorapok global agent stack synced");
  console.log(`  skills: ${synced.join(", ")}`);
  console.log(`  targets: ${TARGET_ROOTS.map((r) => r.replace(homedir(), "~")).join(", ")}`);
  console.log(`  installer: ${binPath.replace(homedir(), "~")}`);

  if (missing.length) {
    console.warn(`  missing in repo: ${missing.join(", ")}`);
    process.exitCode = 1;
  }

  // Sanity: ensure MCP config exists in repo
  const mcpPath = join(repoRoot, ".cursor", "mcp.json");
  if (existsSync(mcpPath)) {
    JSON.parse(readFileSync(mcpPath, "utf8"));
    console.log("  mcp: .cursor/mcp.json OK (authenticate Cloudflare MCP in Cursor IDE)");
  }
}

main();
