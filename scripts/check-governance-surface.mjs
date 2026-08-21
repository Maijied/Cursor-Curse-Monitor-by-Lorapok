#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const staged = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { encoding: "utf8" })
  .split(/\r?\n/).filter(Boolean);
const sensitive = /^(AGENTS\.md|\.cursor\/|\.agents\/|\.codex\/|\.husky\/|\.github\/workflows\/|package\.json$|scripts\/(release|generate|validate|check-governance))/;
if (!staged.some((path) => sensitive.test(path))) process.exit(0);

function fail(message) {
  console.error(`governance check failed: ${message}`);
  process.exitCode = 1;
}

try {
  JSON.parse(readFileSync("package.json", "utf8"));
  JSON.parse(readFileSync(".cursor/mcp.json", "utf8"));
} catch (error) {
  fail(`invalid JSON configuration: ${error instanceof Error ? error.message : String(error)}`);
}

for (const required of ["AGENTS.md", ".cursor/rules/browser-profile.mdc", ".cursor/rules/governance-scope.mdc"]) {
  if (!existsSync(required)) fail(`required governance file is missing: ${required}`);
}

const productionSources = staged.filter((path) => /\.(ts|tsx|js|mjs)$/.test(path));
for (const path of productionSources) {
  if (path === "scripts/check-governance-surface.mjs") continue;
  const text = readFileSync(path, "utf8");
  if (text.includes("127.0.0.1:7556") || text.includes("X-Debug-Session-Id")) {
    fail(`debug beacon detected in staged production source: ${path}`);
  }
}

if (staged.some((path) => path === ".github/workflows/publish-tag.yml")) {
  const workflow = readFileSync(".github/workflows/publish-tag.yml", "utf8");
  if (/Ensure GitHub Release[\s\S]{0,300}continue-on-error:\s*true/.test(workflow)) {
    fail("GitHub Release creation must not be allowed to fail silently");
  }
}

if (process.exitCode) process.exit(1);
console.log("governance surface check passed");
