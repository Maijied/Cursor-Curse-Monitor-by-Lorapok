import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/** Isolated VS Code dev copy — never Cursor. */
export const DEFAULT_VSCODE_DEV_ROOT =
  process.env.CCM_VSCODE_DEV_ROOT ||
  "/mnt/NewVolume/Personal_Projects/cursor-usage-monitor-vscode-dev";

export const VSCODE_DEV_STATE_DIR = ".vscode-dev";

export const RSYNC_EXCLUDES = [
  "node_modules",
  ".git",
  ".cursor",
  ".codex",
  ".agents",
  ".dev-smoke",
  VSCODE_DEV_STATE_DIR,
  ".vscode-test",
  "dist",
  "browser-extension/dist",
  "packages/shared/dist",
  "vendor",
  "*.vsix",
  ".cred-vault-passphrase",
  "**/.cred-vault-passphrase",
];

export function which(bin) {
  const result = spawnSync("which", [bin], { encoding: "utf8" });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }
  return null;
}

/** VS Code CLI only — never falls back to Cursor. */
export function resolveVsCodeCli() {
  if (process.env.EDITOR_BIN) {
    return process.env.EDITOR_BIN;
  }
  return (
    which("code") ||
    (existsSync("/snap/bin/code") ? "/snap/bin/code" : null) ||
    which("code-insiders")
  );
}

export function stateDirFor(root) {
  return join(root, VSCODE_DEV_STATE_DIR);
}

export function chromeProfileFor(root) {
  return join(stateDirFor(root), "chrome-profile");
}

export function testLogFor(root) {
  return join(stateDirFor(root), "last-test.log");
}

export function provisionLogFor(root) {
  return join(stateDirFor(root), "provision.log");
}

export function sandboxMarkerFor(root) {
  return join(stateDirFor(root), "SANDBOX.md");
}
