#!/usr/bin/env node
/**
 * Verify parallel IDE / dev harness isolation settings.
 * Informational only — exits 0 with warnings.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  listRunningEditors,
  resolveEditorCliForRoot,
} from "./lib/dev-isolation.mjs";
import { DEFAULT_VSCODE_DEV_ROOT } from "./lib/vscode-dev-env.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const sandbox = resolve(process.env.CCM_VSCODE_DEV_ROOT || DEFAULT_VSCODE_DEV_ROOT);

const warnings = [];

function warn(msg) {
  warnings.push(msg);
  console.warn(`[isolation] warning: ${msg}`);
}

function ok(msg) {
  console.log(`[isolation] ok: ${msg}`);
}

const running = listRunningEditors();
if (running.length > 1) {
  warn(`Multiple editors running (${running.join(", ")}) — avoid compile/watch in two workspaces at once`);
} else if (running.length === 1) {
  ok(`Active editor process: ${running[0]}`);
}

if (existsSync(join(root, ".dev-smoke"))) {
  ok("Cursor workspace dev-smoke state is isolated under .dev-smoke/");
}

if (existsSync(sandbox)) {
  ok(`VS Code sandbox present: ${sandbox}`);
  const sandboxEditor = resolveEditorCliForRoot(sandbox);
  const mainEditor = resolveEditorCliForRoot(root);
  if (sandboxEditor && mainEditor && sandboxEditor !== mainEditor) {
    ok(`IDE split: main→${mainEditor}, sandbox→${sandboxEditor}`);
  }
} else {
  warn(`VS Code sandbox missing (${sandbox}) — run npm run provision:vscode-dev`);
}

for (const envVar of ["CURSOR_DB_PATH", "CURSOR_EDITOR_RUNNING", "CCM_REINDEX_SEARCH_DB"]) {
  if (process.env[envVar]) {
    warn(`${envVar} is set in shell — scope it to a single command to avoid cross-editor confusion`);
  }
}

if (process.env.CCM_DEV_CHROME === "maizied") {
  warn("CCM_DEV_CHROME=maizied uses your real Chrome profile — use default isolated profile for parallel dev");
}

if (warnings.length === 0) {
  console.log("\n[isolation] No conflicts detected.");
} else {
  console.log(`\n[isolation] ${warnings.length} warning(s). See AGENTS.md § Parallel editors.`);
}

process.exit(0);
