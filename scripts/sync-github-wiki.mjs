#!/usr/bin/env node
/**
 * Push docs/wiki/*.md to the GitHub Wiki repository.
 * Requires: gh CLI authenticated with repo admin access.
 *
 * Usage: node scripts/sync-github-wiki.mjs
 */
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const REPO = "Maijied/Cursor-Curse-Monitor-by-Lorapok";
const WIKI_REPO = `${REPO}.wiki`;
const SRC = resolve("docs/wiki");
const TMP = join(tmpdir(), `ccm-wiki-${Date.now()}`);

mkdirSync(TMP, { recursive: true });

try {
  execSync(`git clone https://github.com/${WIKI_REPO}.git "${TMP}"`, { stdio: "inherit" });
} catch {
  console.error(`Wiki repo not found. Create it on GitHub: Settings → Features → Wikis → enable, then add an initial page.`);
  process.exit(1);
}

for (const file of readdirSync(SRC).filter((f) => f.endsWith(".md"))) {
  cpSync(join(SRC, file), join(TMP, file));
}

execSync("git add -A", { cwd: TMP, stdio: "inherit" });
const status = execSync("git status --porcelain", { cwd: TMP }).toString().trim();
if (!status) {
  console.log("Wiki is already up to date.");
} else {
  execSync('git commit -m "Sync wiki from docs/wiki"', { cwd: TMP, stdio: "inherit" });
  execSync("git push origin master || git push origin main", { cwd: TMP, stdio: "inherit" });
  console.log("Wiki synced.");
}

rmSync(TMP, { recursive: true, force: true });
