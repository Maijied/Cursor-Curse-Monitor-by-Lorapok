#!/usr/bin/env node
/**
 * Local dev smoke harness — build, test, and launch IDE + browser targets.
 * Opt-in only; never runs in CI unless CCM_DEV_SMOKE=1.
 *
 * Usage:
 *   npm run dev:smoke
 *   npm run dev:smoke:quick
 *   node scripts/dev-smoke.mjs --dry-run
 *   node scripts/dev-smoke.mjs --no-launch
 *
 * Env: CCM_DEV_SMOKE, CCM_DEV_CHROME=maizied, CHROME_BIN, FIREFOX_BIN, EDITOR_BIN
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  acquireBuildLock,
  isolatedChromeProfile,
  maiziedChromePath,
  resolveEditorCliForRoot,
} from "./lib/dev-isolation.mjs";

const root = resolve(process.env.CCM_DEV_ROOT || join(dirname(fileURLToPath(import.meta.url)), ".."));
const extDist = join(root, "browser-extension", "dist");
const firefoxExtId = "cursor-curse-monitor@lorapok.tech";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const quick = args.has("--quick");
const noLaunch = args.has("--no-launch");
const skipBuild = args.has("--skip-build");
const skipTests = args.has("--skip-tests");
const keepAlive = args.has("--keep-alive");
const noIde = args.has("--no-ide");
const noFirefox = args.has("--no-firefox");
const noChrome = args.has("--no-chrome");

function log(msg) {
  console.log(`[dev-smoke] ${msg}`);
}

function warn(msg) {
  console.warn(`[dev-smoke] warning: ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`[dev-smoke] error: ${msg}`);
  process.exit(code);
}

function which(bin) {
  const result = spawnSync("which", [bin], { encoding: "utf8" });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }
  return null;
}

function runSync(cmd, runArgs, opts = {}) {
  const label = `${cmd} ${runArgs.join(" ")}`.trim();
  if (dryRun) {
    log(`[dry-run] ${label}`);
    return { status: 0 };
  }
  log(`→ ${label}`);
  return spawnSync(cmd, runArgs, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    ...opts,
  });
}

function spawnDetached(cmd, runArgs, opts = {}) {
  const label = `${cmd} ${runArgs.join(" ")}`.trim();
  if (dryRun) {
    log(`[dry-run] spawn ${label}`);
    return null;
  }
  log(`→ spawn ${label}`);
  const child = spawn(cmd, runArgs, {
    cwd: root,
    detached: true,
    stdio: "ignore",
    shell: false,
    ...opts,
  });
  child.unref();
  return child;
}

function guardCi() {
  if (process.env.CI === "true" && process.env.CCM_DEV_SMOKE !== "1") {
    log("CI=true — skipping dev smoke (set CCM_DEV_SMOKE=1 to force).");
    process.exit(0);
  }
}

function resolveEditorCli() {
  return resolveEditorCliForRoot(root);
}

function resolveChrome() {
  if (process.env.CHROME_BIN) {
    return process.env.CHROME_BIN;
  }
  if (process.env.CCM_DEV_CHROME === "maizied") {
    const maizied = maiziedChromePath();
    if (existsSync(maizied)) {
      return maizied;
    }
    warn("CCM_DEV_CHROME=maizied but ~/.local/bin/chrome-maizied missing; falling back.");
  }
  return (
    which("google-chrome") ||
    which("google-chrome-stable") ||
    which("chromium") ||
    which("chromium-browser")
  );
}

function resolveFirefox() {
  if (process.env.FIREFOX_BIN) {
    return process.env.FIREFOX_BIN;
  }
  return which("firefox");
}

function stepBuild() {
  if (skipBuild) {
    log("skipping build (--skip-build)");
    return;
  }

  const release = acquireBuildLock(root, "compile");
  if (!release) {
    fail("another compile is running in this workspace (.vscode-dev/locks/compile.lock)");
  }

  try {
    const steps = [
      ["npm", ["run", "build", "-w", "@lorapok/cursor-monitor-shared"]],
      ["npm", ["run", "compile"]],
      ["npm", ["run", "browser-ext:build"]],
    ];

    for (const [cmd, runArgs] of steps) {
      const result = runSync(cmd, runArgs);
      if (result.status !== 0) {
        fail(`build failed: ${cmd} ${runArgs.join(" ")}`);
      }
    }
  } finally {
    release();
  }

  if (!existsSync(join(extDist, "manifest.json"))) {
    fail(`missing ${extDist}/manifest.json after build`);
  }
  log("build complete");
}

function stepTests() {
  if (skipTests) {
    log("skipping tests (--skip-tests)");
    return;
  }

  if (quick) {
    const scoped = runSync("node", [
      "--test",
      "tests/test_cursor_accounts.js",
      "tests/test_usage_monitor_lifecycle.test.js",
    ]);
    if (scoped.status !== 0) {
      fail("scoped IDE tests failed");
    }
    const browser = runSync("npm", ["run", "browser-ext:test"]);
    if (browser.status !== 0) {
      fail("browser extension tests failed");
    }
  } else {
    const full = runSync("npm", ["test"]);
    if (full.status !== 0) {
      fail("full test suite failed");
    }
  }
  log("tests passed");
}

function launchIde(editorCli) {
  if (noIde) {
    return;
  }
  if (!editorCli) {
    warn("cursor/code CLI not found — install Cursor or VS Code and add it to PATH.");
    log("Manual: open this repo and press F5 (Run Extension).");
    return;
  }

  spawnDetached(editorCli, [
    "--extensionDevelopmentPath",
    root,
    root,
  ]);
  log(`IDE: opened Extension Development Host via ${editorCli}`);
  log("  → Command Palette → “Cursor Curse Monitor: Open Dashboard” (or use the activity bar).");
}

function launchFirefox(firefoxBin) {
  if (noFirefox) {
    return;
  }

  const webExtBin = join(
    root,
    "node_modules",
    "browser-extension",
    "node_modules",
    ".bin",
    "web-ext",
  );
  const webExt = existsSync(webExtBin) ? webExtBin : "npx";

  const webExtArgs =
    webExt === "npx"
      ? ["web-ext", "run", "--source-dir", extDist, "-t", "firefox"]
      : ["run", "--source-dir", extDist, "-t", "firefox"];

  if (firefoxBin) {
    webExtArgs.push("--firefox", firefoxBin);
  }

  if (keepAlive && !dryRun) {
    log("→ web-ext run (foreground; Ctrl+C to stop Firefox dev session)");
    const result = spawnSync(webExt, webExtArgs, {
      cwd: root,
      stdio: "inherit",
      shell: false,
    });
    if (result.status !== 0) {
      warn("web-ext run exited non-zero — load manually at about:debugging");
      log(`  Load temporary add-on: ${extDist}`);
    }
    return;
  }

  if (webExt === "npx") {
    spawnDetached("npx", webExtArgs);
  } else {
    spawnDetached(webExt, webExtArgs);
  }

  log("Firefox: web-ext run started (temporary profile)");
  log(`  → Popup: moz-extension://${firefoxExtId}/popup.html`);
  log(`  → Fallback: about:debugging → Load Temporary Add-on → ${join(extDist, "manifest.json")}`);
}

function launchChrome(chromeBin) {
  if (noChrome) {
    return;
  }
  if (!chromeBin) {
    warn("Chrome/Chromium not found — set CHROME_BIN or install google-chrome.");
    log(`Manual: chrome://extensions → Load unpacked → ${extDist}`);
    return;
  }

  const profileDir =
    process.env.CCM_DEV_CHROME === "maizied"
      ? join(root, ".dev-smoke", "chrome-profile-maizied")
      : isolatedChromeProfile(root, "dev-smoke");
  const extPath = resolve(extDist);

  const chromeArgs = [
    `--user-data-dir=${profileDir}`,
    `--load-extension=${extPath}`,
    `--disable-extensions-except=${extPath}`,
    "--no-first-run",
    "--no-default-browser-check",
    "https://cursor.com/dashboard",
  ];

  if (process.env.CCM_DEV_CHROME === "maizied") {
    warn("CCM_DEV_CHROME=maizied uses your real profile wrapper — opens a separate window, not your main session.");
  }

  spawnDetached(chromeBin, chromeArgs);
  log(`Chrome: dev window with unpacked extension (${extPath})`);
  log("  → Open chrome://extensions to copy extension ID (varies per dev profile).");
  log("  → Popup: click toolbar icon after load.");
  log("  → Pre-loaded: https://cursor.com/dashboard (for auth capture testing).");
}

function printSummary({ editorCli, chromeBin, firefoxBin }) {
  console.log("\n--- dev smoke summary ---");
  console.log(`Repo:     ${root}`);
  console.log(`Ext dist: ${extDist}`);
  console.log(`Mode:     ${quick ? "quick tests" : "full tests"}${dryRun ? " (dry-run)" : ""}`);
  console.log(`IDE:      ${noIde ? "skipped" : editorCli || "manual F5"}`);
  console.log(`Firefox:  ${noFirefox ? "skipped" : firefoxBin || "web-ext default"}`);
  console.log(`Chrome:   ${noChrome ? "skipped" : chromeBin || "manual load"}`);
  console.log("\nBefore commit/push: verify dashboard, account switcher, and browser popup in each target.");
  console.log("Not part of CI or husky — run explicitly with: npm run dev:smoke\n");
}

export function parseDevSmokeArgv(argv = process.argv.slice(2)) {
  const set = new Set(argv);
  return {
    dryRun: set.has("--dry-run"),
    quick: set.has("--quick"),
    noLaunch: set.has("--no-launch"),
    skipBuild: set.has("--skip-build"),
    skipTests: set.has("--skip-tests"),
    keepAlive: set.has("--keep-alive"),
    noIde: set.has("--no-ide"),
    noFirefox: set.has("--no-firefox"),
    noChrome: set.has("--no-chrome"),
  };
}

export function buildChromeLaunchArgs(extDistPath, profileDir) {
  const extPath = resolve(extDistPath);
  return [
    `--user-data-dir=${profileDir}`,
    `--load-extension=${extPath}`,
    `--disable-extensions-except=${extPath}`,
    "--no-first-run",
    "--no-default-browser-check",
    "https://cursor.com/dashboard",
  ];
}

function main() {
  guardCi();

  log(
    `starting${quick ? " (quick)" : ""}${dryRun ? " (dry-run)" : ""}${noLaunch ? " (no-launch)" : ""}`,
  );

  stepBuild();
  stepTests();

  const editorCli = resolveEditorCli();
  const chromeBin = resolveChrome();
  const firefoxBin = resolveFirefox();

  if (!noLaunch) {
    launchIde(editorCli);
    launchFirefox(firefoxBin);
    launchChrome(chromeBin);
  } else {
    log("skipping launches (--no-launch)");
  }

  printSummary({ editorCli, chromeBin, firefoxBin });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main();
}
