#!/usr/bin/env node
/**
 * Propagate the computed version to workspace packages for builds only.
 * Committed package.json files stay at 0.0.0 — CI resolves live marketplace
 * versions and runs version:sync before compile/package.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeVersion } from "./compute-version.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_PLACEHOLDER = "0.0.0";

const TARGETS = [
  { path: "package.json", field: "version" },
  { path: "browser-extension/package.json", field: "version" },
  { path: "browser-extension/manifest.json", field: "version" },
  { path: "packages/shared/package.json", field: "version" },
];

function readJson(relPath) {
  const abs = join(root, relPath);
  return { abs, data: JSON.parse(readFileSync(abs, "utf8")) };
}

function writeJson(abs, data) {
  writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/**
 * @param {string} [explicitVersion]
 * @param {{ dryRun?: boolean }} [opts]
 */
export function syncWorkspaceVersions(explicitVersion, opts = {}) {
  const version = explicitVersion ?? computeVersion();
  const changes = [];

  for (const target of TARGETS) {
    const { abs, data } = readJson(target.path);
    if (data[target.field] === version) continue;
    changes.push({ path: target.path, from: data[target.field], to: version });
    if (!opts.dryRun) {
      data[target.field] = version;
      writeJson(abs, data);
    }
  }

  return { version, changes };
}

/** Ensure committed package.json versions stay at the workspace placeholder. */
export function assertWorkspacePlaceholders() {
  const violations = [];
  for (const target of TARGETS) {
    const { data } = readJson(target.path);
    const value = data[target.field];
    if (value !== WORKSPACE_PLACEHOLDER) {
      violations.push(
        `${target.path} is "${value}" — commit ${WORKSPACE_PLACEHOLDER} and run npm run version:sync at build time`,
      );
    }
  }
  return violations;
}

function parseArgs(argv) {
  const args = { check: false, dryRun: false, version: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--check") args.check = true;
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--version" && argv[i + 1]) {
      args.version = argv[++i];
    }
  }
  return args;
}

const isCli = process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) {
  const args = parseArgs(process.argv);
  if (args.check) {
    const violations = assertWorkspacePlaceholders();
    if (violations.length) {
      console.error("version sync check failed:");
      for (const line of violations) console.error(`  - ${line}`);
      process.exit(1);
    }
    console.log("workspace version placeholders OK (0.0.0)");
    process.exit(0);
  }

  const result = syncWorkspaceVersions(args.version ?? undefined, { dryRun: args.dryRun });
  if (args.dryRun) {
    for (const change of result.changes) {
      console.log(`${change.path}: ${change.from} → ${change.to}`);
    }
  } else if (result.changes.length) {
    console.log(`synced version ${result.version} to ${result.changes.length} file(s)`);
  } else {
    console.log(`version ${result.version} already synced`);
  }
}
