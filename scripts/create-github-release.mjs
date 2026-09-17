#!/usr/bin/env node
/**
 * Stage marketplace build artifacts and create/update a GitHub Release with
 * retrying asset uploads. Softprops/action-gh-release fails the whole job on
 * transient GitHub "Unicorn" 5xx responses mid-upload and can leave a draft
 * release with only some assets attached.
 *
 * Usage (CI):
 *   node scripts/create-github-release.mjs \
 *     --tag v1.0.172 \
 *     --name "Cursor Curse Monitor v1.0.172" \
 *     [--prerelease]
 *
 * Env: GITHUB_TOKEN or GH_TOKEN (required for gh).
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const stagingDir = join(root, ".release-assets");

function parseArgs(argv) {
  const out = { tag: "", name: "", prerelease: false, generateNotes: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tag") out.tag = String(argv[++i] || "").trim();
    else if (a === "--name") out.name = String(argv[++i] || "").trim();
    else if (a === "--prerelease") out.prerelease = true;
    else if (a === "--no-generate-notes") out.generateNotes = false;
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/create-github-release.mjs --tag vX.Y.Z --name \"...\" [--prerelease]",
      );
      process.exit(0);
    }
  }
  return out;
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    ...opts,
  });
  return {
    status: res.status ?? 1,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    error: res.error,
  };
}

function gh(args, opts = {}) {
  return run("gh", args, opts);
}

function die(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}

function collectGlobs(version) {
  /** @type {string[]} */
  const files = [];
  const matchesVersion = (name) => {
    if (!version) return true;
    return name.includes(version);
  };
  const addDirMatches = (dir, ext) => {
    const abs = join(root, dir);
    if (!existsSync(abs)) return;
    for (const name of readdirSync(abs)) {
      if (!name.endsWith(ext)) continue;
      if (!matchesVersion(name)) continue;
      const full = join(abs, name);
      if (statSync(full).isFile()) files.push(full);
    }
  };

  // Root VSIX packages from vsce (filter by release version when known)
  if (existsSync(root)) {
    for (const name of readdirSync(root)) {
      if (!name.endsWith(".vsix")) continue;
      if (!matchesVersion(name)) continue;
      const full = join(root, name);
      if (statSync(full).isFile()) files.push(full);
    }
  }

  addDirMatches("browser-extension/artifacts/chrome", ".zip");
  addDirMatches("browser-extension/artifacts/firefox", ".xpi");

  return files;
}

function stageAssets(files) {
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });
  /** @type {string[]} */
  const staged = [];
  for (const src of files) {
    const dest = join(stagingDir, basename(src));
    copyFileSync(src, dest);
    staged.push(dest);
  }
  return staged;
}

function sleepMs(ms) {
  const secs = Math.max(1, Math.ceil(ms / 1000));
  spawnSync("sleep", [String(secs)], { stdio: "ignore" });
}

function releaseExists(tag) {
  const res = gh(["release", "view", tag, "--json", "id,isDraft,url"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (res.status !== 0) return null;
  try {
    return JSON.parse(res.stdout);
  } catch {
    return null;
  }
}

function createRelease(tag, name, { prerelease, generateNotes }) {
  const args = ["release", "create", tag, "--title", name, "--draft"];
  if (prerelease) args.push("--prerelease");
  if (generateNotes) args.push("--generate-notes");
  else args.push("--notes", "");
  const res = gh(args);
  if (res.status !== 0) {
    die(
      `gh release create failed:\n${res.stderr || res.stdout || res.error?.message || ""}`,
    );
  }
}

function uploadWithRetries(tag, filePath, { attempts = 6 } = {}) {
  const name = basename(filePath);
  for (let i = 1; i <= attempts; i++) {
    console.log(`Uploading ${name} (attempt ${i}/${attempts})…`);
    const res = gh(["release", "upload", tag, filePath, "--clobber"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (res.status === 0) {
      console.log(`✅ Uploaded ${name}`);
      return;
    }
    const detail = `${res.stderr}\n${res.stdout}`.trim();
    const transient =
      /unicorn|502|503|504|timeout|ECONNRESET|ETIMEDOUT|temporarily unavailable|not yet discoverable/i.test(
        detail,
      ) || detail.includes("<!DOCTYPE html>");
    console.warn(`Upload failed for ${name}: ${detail.slice(0, 400)}`);
    if (!transient || i === attempts) {
      die(`Failed to upload ${name} after ${i} attempt(s)`);
    }
    const wait = Math.min(90_000, 10_000 * i);
    console.warn(`Transient GitHub error — retrying in ${Math.round(wait / 1000)}s…`);
    sleepMs(wait);
  }
}

function publishRelease(tag) {
  const res = gh(["release", "edit", tag, "--draft=false"]);
  if (res.status !== 0) {
    die(
      `gh release edit --draft=false failed:\n${res.stderr || res.stdout || ""}`,
    );
  }
  console.log(`Published release ${tag}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.tag) die("Missing --tag (e.g. v1.0.172)");
  if (!opts.name) opts.name = `Cursor Curse Monitor ${opts.tag.replace(/^v/, "v")}`;

  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    die("GITHUB_TOKEN or GH_TOKEN is required");
  }

  const version = opts.tag.replace(/^v/, "");
  const collected = collectGlobs(version);
  if (collected.length === 0) {
    die(
      `No release assets found for ${version} (expected *.vsix and/or chrome zip / firefox xpi matching that version)`,
    );
  }

  const hasXpi = collected.some((f) => f.endsWith(".xpi"));
  if (!hasXpi) {
    console.log(
      "::notice::No signed Firefox XPI in workspace (AMO often leaves signing pending) — omitting from GitHub Release",
    );
  }

  const staged = stageAssets(collected);
  console.log(`Staged ${staged.length} asset(s) in ${stagingDir}:`);
  for (const f of staged) console.log(`  - ${basename(f)}`);

  let existing = releaseExists(opts.tag);
  if (!existing) {
    console.log(`Creating draft release ${opts.tag}…`);
    createRelease(opts.tag, opts.name, opts);
    // brief wait for release discoverability
    for (let i = 0; i < 5; i++) {
      sleepMs(2000);
      existing = releaseExists(opts.tag);
      if (existing) break;
    }
    if (!existing) die(`Release ${opts.tag} was created but is not discoverable yet`);
  } else {
    console.log(
      `Release ${opts.tag} already exists (draft=${existing.isDraft}) — uploading/clobbering assets`,
    );
    // Keep title in sync on retries
    gh(["release", "edit", opts.tag, "--title", opts.name], {
      stdio: "inherit",
    });
  }

  for (const file of staged) {
    uploadWithRetries(opts.tag, file);
  }

  publishRelease(opts.tag);

  const final = releaseExists(opts.tag);
  if (final?.url) console.log(`Release URL: ${final.url}`);
}

main();
