#!/usr/bin/env node
/**
 * In-repo VS Code smoke window — no Personal_Projects sandbox / no rsync sync.
 *
 * Opens a minimal workspace under .vscode-test/workspace with an isolated VS Code
 * profile so only this extension is developed (clean user-data + extensions dirs).
 *
 *   node scripts/vscode-test-folder.mjs
 *   node scripts/vscode-test-folder.mjs --fresh
 *   node scripts/vscode-test-folder.mjs --no-launch
 *
 * Env: EDITOR_BIN (VS Code CLI, never Cursor)
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { acquireBuildLock } from "./lib/dev-isolation.mjs";
import { resolveVsCodeCli } from "./lib/vscode-dev-env.mjs";

const repoRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));
const testRoot = join(repoRoot, ".vscode-test");
const workspaceDir = join(testRoot, "workspace");
const userDataDir = join(testRoot, "user-data");
const extensionsDir = join(testRoot, "extensions");

const flags = new Set(process.argv.slice(2));
const fresh = flags.has("--fresh");
const noLaunch = flags.has("--no-launch");
const dryRun = flags.has("--dry-run");

function log(msg) {
  console.log(`[vscode-test] ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`[vscode-test] error: ${msg}`);
  process.exit(code);
}

function run(cmd, args, opts = {}) {
  const label = `${cmd} ${args.join(" ")}`.trim();
  if (dryRun) {
    log(`[dry-run] ${label}`);
    return { status: 0 };
  }
  log(`→ ${label}`);
  return spawnSync(cmd, args, {
    cwd: opts.cwd || repoRoot,
    stdio: "inherit",
    shell: false,
    ...opts,
  });
}

function ensureWorkspace() {
  mkdirSync(workspaceDir, { recursive: true });
  const readme = join(workspaceDir, "README.md");
  if (!existsSync(readme)) {
    writeFileSync(
      readme,
      `# CCM extension test workspace

Minimal folder for the VS Code Extension Development Host.

- Extension source: \`${repoRoot}\`
- Open dashboard: Command Palette → **Cursor Curse Monitor: Open Dashboard**
`,
      "utf8",
    );
  }
  log(`test workspace: ${workspaceDir}`);
}

function wipeProfile() {
  for (const dir of [userDataDir, extensionsDir]) {
    if (existsSync(dir)) {
      if (dryRun) {
        log(`[dry-run] rm -rf ${dir}`);
      } else {
        rmSync(dir, { recursive: true, force: true });
        log(`removed ${dir}`);
      }
    }
  }
}

function stepBuild() {
  const release = acquireBuildLock(repoRoot, "compile");
  if (!release) {
    fail("compile lock held — close the other VS Code/Cursor compile or delete .vscode-dev/locks/compile.lock");
  }
  try {
    const shared = run("npm", ["run", "build", "-w", "@lorapok/cursor-monitor-shared"]);
    if (shared.status !== 0) {
      fail("shared package build failed");
    }
    const compile = run("npm", ["run", "compile"]);
    if (compile.status !== 0) {
      fail("extension compile failed");
    }
  } finally {
    release();
  }
  log("build complete");
}

function launchVsCode() {
  if (noLaunch) {
    return;
  }

  const codeCli = resolveVsCodeCli();
  if (!codeCli) {
    fail("VS Code CLI not found — install VS Code and ensure `code` is on PATH (or set EDITOR_BIN)");
  }

  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(extensionsDir, { recursive: true });

  const args = [
    `--user-data-dir=${userDataDir}`,
    `--extensions-dir=${extensionsDir}`,
    "--extensionDevelopmentPath",
    repoRoot,
    workspaceDir,
  ];

  if (dryRun) {
    log(`[dry-run] ${codeCli} ${args.join(" ")}`);
    return;
  }

  const child = spawn(codeCli, args, { detached: true, stdio: "ignore", shell: false });
  child.unref();
  log(`opened VS Code (${codeCli})`);
  log(`  workspace:  ${workspaceDir}`);
  log(`  profile:    ${userDataDir}`);
  log(`  extension:  ${repoRoot}`);
  log("  → Command Palette → Cursor Curse Monitor: Open Dashboard");
  log("  → Or press F5 with “Run Extension (VS Code — test folder)” if you opened the repo instead");
}

if (fresh) {
  wipeProfile();
}
ensureWorkspace();
stepBuild();
launchVsCode();

console.log("\n--- In-repo VS Code test (no sandbox sync) ---");
console.log(`Repo:       ${repoRoot}`);
console.log(`Workspace:  ${workspaceDir}`);
console.log(`Profile:    ${userDataDir}`);
console.log(`Fresh:      ${fresh ? "yes" : "no (pass --fresh to reset profile)"}\n`);
