import { existsSync, mkdirSync, openSync, closeSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const DEFAULT_VSCODE_DEV_ROOT =
  process.env.CCM_VSCODE_DEV_ROOT ||
  "/mnt/NewVolume/Personal_Projects/cursor-usage-monitor-vscode-dev";

/** Per-run Chrome profile so parallel smokes do not share extension state. */
export function isolatedChromeProfile(root, namespace = "dev-smoke") {
  const base = join(root, namespace, "chrome-profiles");
  mkdirSync(base, { recursive: true });
  return join(base, `run-${process.pid}`);
}

export function resolveDevRoot(scriptRoot, envRoot = process.env.CCM_DEV_ROOT) {
  return resolve(envRoot || scriptRoot);
}

export function isVsCodeSandboxPath(root) {
  const normalized = root.toLowerCase();
  return (
    normalized.includes("vscode-dev") ||
    normalized.includes("cursor-usage-monitor-vscode-dev")
  );
}

export function which(bin) {
  const result = spawnSync("which", [bin], { encoding: "utf8" });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }
  return null;
}

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

export function resolveCursorCli() {
  return which("cursor");
}

/**
 * Pick IDE CLI without cross-contamination:
 * - CCM_DEV_IDE=vscode|cursor forces the choice
 * - VS Code sandbox paths always use code
 * - Main Cursor workspace defaults to cursor
 */
export function resolveEditorCliForRoot(root) {
  if (process.env.EDITOR_BIN) {
    return process.env.EDITOR_BIN;
  }
  const forced = process.env.CCM_DEV_IDE;
  if (forced === "vscode") {
    return resolveVsCodeCli();
  }
  if (forced === "cursor") {
    return resolveCursorCli();
  }
  if (isVsCodeSandboxPath(root)) {
    return resolveVsCodeCli();
  }
  return resolveCursorCli() || resolveVsCodeCli();
}

/** Acquire exclusive build lock (dist compile). Returns release() or null if busy. */
export function acquireBuildLock(root, label = "compile") {
  const lockDir = join(root, ".vscode-dev", "locks");
  mkdirSync(lockDir, { recursive: true });
  const lockPath = join(lockDir, `${label}.lock`);
  try {
    const fd = openSync(lockPath, "wx");
    closeSync(fd);
    return () => {
      try {
        unlinkSync(lockPath);
      } catch {
        // ignore
      }
    };
  } catch {
    return null;
  }
}

export const EDITOR_PROCESS_PATTERNS = {
  cursor: ["Cursor.exe", "Cursor", "cursor"],
  vscode: ["Code.exe", "code", "Code - OSS", "code-oss"],
  agy: ["agy", "AGY", "Antigravity"],
};

export function isProcessRunning(patterns) {
  try {
    if (process.platform === "win32") {
      const out = spawnSync("tasklist", { encoding: "utf8", timeout: 3000 });
      const text = (out.stdout || "").toLowerCase();
      return patterns.some((p) => text.includes(p.toLowerCase()));
    }
    const out = spawnSync("ps", ["-A", "-o", "comm="], { encoding: "utf8", timeout: 3000 });
    const lines = (out.stdout || "").split("\n").map((l) => l.trim());
    return patterns.some((p) =>
      lines.some(
        (line) => line === p || line.endsWith(`/${p}`) || line.toLowerCase() === p.toLowerCase(),
      ),
    );
  } catch {
    return true;
  }
}

export function listRunningEditors() {
  const running = [];
  for (const [name, patterns] of Object.entries(EDITOR_PROCESS_PATTERNS)) {
    if (isProcessRunning(patterns)) {
      running.push(name);
    }
  }
  return running;
}

export function maiziedChromePath() {
  return join(homedir(), ".local", "bin", "chrome-maizied");
}
