#!/usr/bin/env node
/**
 * Isolated VS Code dev environment under Personal_Projects.
 * Fresh npm install, tests, output logs — never uses Cursor IDE.
 *
 *   node scripts/vscode-dev-env.mjs provision   # rsync + npm ci + VS Code config
 *   node scripts/vscode-dev-env.mjs sync        # rsync source → sandbox (current edits)
 *   node scripts/vscode-dev-env.mjs run         # build, test, open VS Code Extension Host
 *   node scripts/vscode-dev-env.mjs all         # provision + test + open VS Code
 *
 * Env: CCM_VSCODE_DEV_ROOT, EDITOR_BIN=/snap/bin/code
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  acquireBuildLock,
  resolveEditorCliForRoot,
  resolveVsCodeCli,
} from "./lib/dev-isolation.mjs";
import {
  DEFAULT_VSCODE_DEV_ROOT,
  RSYNC_EXCLUDES,
  chromeProfileFor,
  provisionLogFor,
  sandboxMarkerFor,
  stateDirFor,
  testLogFor,
} from "./lib/vscode-dev-env.mjs";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const targetRoot = resolve(process.env.CCM_VSCODE_DEV_ROOT || DEFAULT_VSCODE_DEV_ROOT);

const argv = process.argv.slice(2);
const command = argv[0] || "all";
const flags = new Set(argv.slice(1));
const dryRun = flags.has("--dry-run");
const fresh = flags.has("--fresh");
const quick = flags.has("--quick");
const noLaunch = flags.has("--no-launch");
const skipTests = flags.has("--skip-tests");

function log(msg) {
  console.log(`[vscode-dev] ${msg}`);
}

function warn(msg) {
  console.warn(`[vscode-dev] warning: ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`[vscode-dev] error: ${msg}`);
  process.exit(code);
}

function run(cmd, args, opts = {}) {
  const label = `${cmd} ${args.join(" ")}`.trim();
  if (dryRun) {
    log(`[dry-run] ${label}`);
    return { status: 0, stdout: "", stderr: "" };
  }
  log(`→ ${label}`);
  return spawnSync(cmd, args, {
    stdio: opts.inherit === false ? "pipe" : "inherit",
    encoding: opts.inherit === false ? "utf8" : undefined,
    cwd: opts.cwd || sourceRoot,
    shell: false,
    ...opts,
  });
}

function gitSource(args, opts = {}) {
  return run("git", args, { cwd: sourceRoot, inherit: false, ...opts });
}

function sourceRevision() {
  const r = gitSource(["rev-parse", "--short", "HEAD"]);
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function ensureSandboxDir() {
  if (!existsSync(targetRoot)) {
    if (dryRun) {
      log(`[dry-run] mkdir -p ${targetRoot}`);
    } else {
      mkdirSync(targetRoot, { recursive: true });
      log(`created sandbox directory: ${targetRoot}`);
    }
    return;
  }
  log(`sandbox directory: ${targetRoot}`);
}

function syncFiles() {
  if (!existsSync(targetRoot)) {
    fail("sandbox missing — run: node scripts/vscode-dev-env.mjs provision");
  }

  const rsyncArgs = ["-a", "--delete"];
  for (const ex of RSYNC_EXCLUDES) {
    rsyncArgs.push("--exclude", ex);
  }
  rsyncArgs.push(`${sourceRoot}/`, `${targetRoot}/`);

  const rsync = run("rsync", rsyncArgs);
  if (rsync.status !== 0) {
    fail("rsync sync failed — is rsync installed?");
  }
  log(`synced from ${sourceRoot} → ${targetRoot} (rev ${sourceRevision()})`);
}

function purgeCursorArtifacts() {
  const paths = [
    join(targetRoot, ".cursor"),
    join(targetRoot, ".codex"),
    join(targetRoot, ".agents"),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      if (dryRun) {
        log(`[dry-run] rm -rf ${p}`);
      } else {
        rmSync(p, { recursive: true, force: true });
        log(`removed ${p}`);
      }
    }
  }
}

function writeVsCodeConfig() {
  const vscodeDir = join(targetRoot, ".vscode");
  if (!dryRun) {
    mkdirSync(vscodeDir, { recursive: true });
  }

  const codeCli = resolveVsCodeCli() || "code";
  const settings = {
    "npm.packageManager": "npm",
    "npm.enableRunFromFolder": true,
    "npm.scriptExplorerAction": "run",
    "npm.exclude": "**/node_modules/**",
    "terminal.integrated.env.linux": {
      CCM_DEV_IDE: "vscode",
      CCM_DEV_ROOT: targetRoot,
      CCM_PRODUCT_DATA_FOLDER: "Cursor",
      EDITOR_BIN: codeCli,
    },
    "files.watcherExclude": {
      "**/node_modules/**": true,
      "**/dist/**": true,
      "**/.vscode-dev/**": true,
    },
    "files.exclude": {
      "**/.cursor": true,
    },
  };

  const launch = {
    version: "0.2.0",
    configurations: [
      {
        name: "Run Extension (VS Code)",
        type: "extensionHost",
        request: "launch",
        preLaunchTask: "compile",
        args: ["--extensionDevelopmentPath=${workspaceFolder}"],
        outFiles: ["${workspaceFolder}/dist/**/*.js"],
        env: {
          CCM_DEV_IDE: "vscode",
          CCM_DEV_ROOT: "${workspaceFolder}",
          CCM_PRODUCT_DATA_FOLDER: "Cursor",
        },
      },
    ],
  };

  const tasks = {
    version: "2.0.0",
    tasks: [
      {
        label: "compile",
        type: "npm",
        script: "compile",
        group: "build",
        problemMatcher: "$tsc",
        presentation: { reveal: "silent", panel: "shared" },
      },
      {
        label: "vscode-dev-test",
        type: "shell",
        command: "node scripts/vscode-dev-env.mjs run --no-launch",
        options: { cwd: "${workspaceFolder}" },
        problemMatcher: [],
      },
    ],
  };

  const extensions = {
    recommendations: ["dbaeumer.vscode-eslint"],
    unwantedRecommendations: [],
  };

  const write = (name, data) => {
    const path = join(vscodeDir, name);
    if (dryRun) {
      log(`[dry-run] write ${path}`);
      return;
    }
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  };

  write("settings.json", settings);
  write("launch.json", launch);
  write("tasks.json", tasks);
  write("extensions.json", extensions);
  log("wrote VS Code–only .vscode config (no Cursor)");
}

function writeSandboxDocs() {
  const state = stateDirFor(targetRoot);
  if (!dryRun) {
    mkdirSync(state, { recursive: true });
  }

  const codeCli = resolveVsCodeCli() || "code";
  const marker = `# VS Code dev sandbox

This folder is an **isolated copy** for building and testing with **VS Code only** (not Cursor).

| Item | Path |
|------|------|
| Sandbox root | \`${targetRoot}\` |
| Source (Cursor workspace) | \`${sourceRoot}\` |
| Source git rev | \`${sourceRevision()}\` |
| Test log | \`${testLogFor(targetRoot)}\` |
| Chrome dev profile | \`${chromeProfileFor(targetRoot)}\` |
| VS Code CLI | \`${codeCli}\` |

## Commands (from either folder)

\`\`\`bash
# From Cursor workspace
npm run provision:vscode-dev
npm run dev:vscode:all

# Re-sync after editing in Cursor
npm run sync:vscode-dev
\`\`\`

## Manual check in VS Code

1. Open this folder in **VS Code** (not Cursor): \`${codeCli} "${targetRoot}"\`
2. Press **F5** → "Run Extension (VS Code)"
3. Command Palette → **Cursor Curse Monitor: Open Dashboard**

## Re-sync after editing in Cursor

\`\`\`bash
npm run sync:vscode-dev
\`\`\`

Then rebuild in VS Code (F5 or \`npm run compile\`).
`;

  const openSh = `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export EDITOR_BIN="${codeCli}"
export CCM_DEV_IDE=vscode
export CCM_DEV_ROOT="$ROOT"
exec "$EDITOR_BIN" --extensionDevelopmentPath="$ROOT" "$ROOT"
`;

  if (dryRun) {
    log(`[dry-run] write ${sandboxMarkerFor(targetRoot)}`);
    return;
  }

  writeFileSync(sandboxMarkerFor(targetRoot), marker, "utf8");
  const launcher = join(state, "open-vscode.sh");
  writeFileSync(launcher, openSh, { mode: 0o755 });
  log(`sandbox docs: ${sandboxMarkerFor(targetRoot)}`);
}

function npmCiFresh() {
  const nodeModules = join(targetRoot, "node_modules");

  if (!fresh && existsSync(nodeModules)) {
    log("node_modules present — skipping npm ci (pass --fresh to reinstall)");
    return;
  }

  if (fresh && existsSync(nodeModules)) {
    if (dryRun) {
      log("[dry-run] rm -rf node_modules");
    } else {
      rmSync(nodeModules, { recursive: true, force: true });
    }
  }

  const ci = run("npm", ["ci"], { cwd: targetRoot });
  if (ci.status !== 0) {
    fail("npm ci failed in sandbox");
  }
  log("npm ci complete in sandbox");
}

function stepBuild() {
  const release = acquireBuildLock(targetRoot, "compile");
  if (!release) {
    fail("another compile is running in the VS Code sandbox (.vscode-dev/locks/compile.lock)");
  }

  const steps = [
    ["npm", ["run", "build", "-w", "@lorapok/cursor-monitor-shared"]],
    ["npm", ["run", "compile"]],
    ["npm", ["run", "browser-ext:build"]],
  ];
  try {
    for (const [cmd, args] of steps) {
      const r = run(cmd, args, { cwd: targetRoot });
      if (r.status !== 0) {
        fail(`build failed: ${cmd} ${args.join(" ")}`);
      }
    }
  } finally {
    release();
  }
  log("build complete");
}

function stepTests() {
  if (skipTests) {
    log("skipping tests");
    return;
  }

  const logPath = testLogFor(targetRoot);
  if (!dryRun) {
    mkdirSync(dirname(logPath), { recursive: true });
  }

  const testCmd = quick
    ? "node --test tests/test_cursor_accounts.js tests/test_usage_monitor_lifecycle.test.js && npm run browser-ext:test"
    : "npm test";

  if (dryRun) {
    log(`[dry-run] (cd sandbox) ${testCmd}`);
    return;
  }

  const shell = spawnSync("bash", ["-lc", `${testCmd} 2>&1 | tee "${logPath}"`], {
    cwd: targetRoot,
    stdio: "inherit",
    shell: false,
  });

  if (shell.status !== 0) {
    fail(`tests failed — see ${logPath}`);
  }
  log(`tests passed — log: ${logPath}`);
}

function launchVsCode() {
  if (noLaunch) {
    return;
  }

  const codeCli = resolveVsCodeCli();
  if (!codeCli) {
    warn("VS Code CLI not found — install VS Code and ensure `code` is on PATH");
    log(`Manual: code --extensionDevelopmentPath="${targetRoot}" "${targetRoot}"`);
    return;
  }

  if (dryRun) {
    log(`[dry-run] ${codeCli} --extensionDevelopmentPath=${targetRoot} ${targetRoot}`);
    return;
  }

  const child = spawn(
    codeCli,
    ["--extensionDevelopmentPath", targetRoot, targetRoot],
    { detached: true, stdio: "ignore", shell: false },
  );
  child.unref();
  log(`opened VS Code Extension Development Host via ${codeCli}`);
  log('  → Press F5 with "Run Extension (VS Code)" if the host window did not start the extension');
  log(`  → Sandbox guide: ${sandboxMarkerFor(targetRoot)}`);
}

function cmdProvision() {
  ensureSandboxDir();
  syncFiles();
  purgeCursorArtifacts();
  writeVsCodeConfig();
  writeSandboxDocs();
  npmCiFresh();
  stepBuild();

  if (!dryRun) {
    const stamp = new Date().toISOString();
    mkdirSync(stateDirFor(targetRoot), { recursive: true });
    writeFileSync(
      provisionLogFor(targetRoot),
      `provisioned ${stamp} from ${sourceRevision()}\n`,
      "utf8",
    );
  }

  log(`provision complete → ${targetRoot}`);
}

function cmdSync() {
  ensureSandboxDir();
  syncFiles();
  purgeCursorArtifacts();
  writeVsCodeConfig();
  writeSandboxDocs();
  log("sync complete — run npm ci in sandbox if package-lock.json changed");
}

function cmdRun() {
  if (!existsSync(targetRoot)) {
    fail("sandbox missing — run provision first");
  }
  process.env.CCM_DEV_IDE = "vscode";
  process.env.EDITOR_BIN = resolveEditorCliForRoot(targetRoot) || "code";
  stepBuild();
  stepTests();
  launchVsCode();
  printSummary();
}

function cmdAll() {
  cmdProvision();
  if (!skipTests) {
    stepTests();
  }
  launchVsCode();
  printSummary();
}

function printSummary() {
  const codeCli = resolveVsCodeCli() || "(install VS Code)";
  console.log("\n--- VS Code dev sandbox ---");
  console.log(`Sandbox:  ${targetRoot}`);
  console.log(`Source:   ${sourceRoot} (${sourceRevision()})`);
  console.log(`IDE:      VS Code only (${codeCli})`);
  console.log(`Tests:    ${testLogFor(targetRoot)}`);
  console.log(`Open:     ${join(stateDirFor(targetRoot), "open-vscode.sh")}`);
  console.log("\nEdit in Cursor → sync: npm run sync:vscode-dev\n");
}

const commands = {
  provision: cmdProvision,
  sync: cmdSync,
  run: cmdRun,
  all: cmdAll,
};

if (!commands[command]) {
  fail(`unknown command "${command}" — use: ${Object.keys(commands).join(", ")}`);
}

commands[command]();
