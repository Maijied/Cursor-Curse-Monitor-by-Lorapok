#!/usr/bin/env node
/**
 * Publish to Open VSX under the canonical lorapok-labs namespace.
 *
 * package.json uses publisher "LorapokLabs" for VS Code Marketplace, but ovsx
 * reads the publisher from the VSIX manifest. Without repacking, publishes land
 * on the wrong Open VSX namespace (LorapokLabs duplicate listing).
 */
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OVSX_PUBLISHER = "lorapok-labs";
const VSCE_PUBLISHER = "LorapokLabs";

function parseArgs(argv) {
  const args = { dryRun: false, preRelease: false, vsix: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--pre-release") args.preRelease = true;
    else if (arg === "--vsix" && argv[i + 1]) args.vsix = argv[++i];
    else if (arg === "-h" || arg === "--help") {
      console.log(`Usage: node scripts/publish-ovsx.mjs [options]

Options:
  --vsix <path>     VSIX to publish (default: newest *.vsix in repo root)
  --pre-release     Pass --pre-release to ovsx publish
  --dry-run         Repack and validate manifest only; do not publish
`);
      process.exit(0);
    }
  }
  return args;
}

function findDefaultVsix() {
  const candidates = readdirSync(root)
    .filter((name) => name.endsWith(".vsix"))
    .map((name) => ({
      name,
      path: join(root, name),
      mtime: statSync(join(root, name)).mtimeMs,
    }));

  if (candidates.length === 0) {
    throw new Error("No *.vsix found in repo root. Run npm run package first.");
  }

  // Prefer package.json version match, else newest by name sort (semver-ish)
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const expected = `${pkg.name}-${pkg.version}.vsix`;
  const exact = candidates.find((c) => c.name === expected);
  if (exact) return exact.path;

  candidates.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
  return candidates[0].path;
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: opts.inherit ? "inherit" : "pipe",
    encoding: "utf8",
    cwd: opts.cwd,
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    const stdout = result.stdout?.trim() ?? "";
    throw new Error(
      `${cmd} ${args.join(" ")} failed (${result.status})${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ""}`
    );
  }
  return result.stdout ?? "";
}

function repackForOvsx(sourceVsix) {
  const workDir = mkdtempSync(join(tmpdir(), "ovsx-repack-"));
  const extractDir = join(workDir, "extract");
  const outVsix = join(workDir, "ovsx-canonical.vsix");

  try {
    run("unzip", ["-q", sourceVsix, "-d", extractDir]);

    const manifestPath = join(extractDir, "extension", "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const originalPublisher = manifest.publisher;

    if (originalPublisher !== OVSX_PUBLISHER) {
      manifest.publisher = OVSX_PUBLISHER;
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    }

    if (manifest.publisher !== OVSX_PUBLISHER) {
      throw new Error(`Failed to set Open VSX publisher to ${OVSX_PUBLISHER}`);
    }

    // Recreate VSIX from extension/ contents (same layout vsce uses)
    run("zip", ["-qr", outVsix, "extension"], { cwd: extractDir });

    return {
      outVsix,
      workDir,
      version: manifest.version,
      originalPublisher,
      patchedPublisher: manifest.publisher,
    };
  } catch (err) {
    rmSync(workDir, { recursive: true, force: true });
    throw err;
  }
}

function publishVsix(vsixPath, preRelease) {
  const token = process.env.OVSX_PAT;
  if (!token) {
    throw new Error("OVSX_PAT is not set");
  }

  const nsResult = spawnSync("npx", ["ovsx", "create-namespace", OVSX_PUBLISHER, "-p", token], {
    encoding: "utf8",
  });
  const nsOutput = `${nsResult.stdout ?? ""}${nsResult.stderr ?? ""}`;
  if (nsResult.status !== 0 && !/already exists/i.test(nsOutput)) {
    throw new Error(`create-namespace failed: ${nsOutput.trim() || nsResult.status}`);
  }

  const publishArgs = ["ovsx", "publish", "-i", vsixPath, "-p", token];
  if (preRelease) publishArgs.push("--pre-release");

  const output = run("npx", publishArgs);
  return output;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceVsix = resolve(args.vsix ?? findDefaultVsix());
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

  console.log(`Source VSIX: ${sourceVsix}`);
  console.log(`Root package publisher (VS Code): ${pkg.publisher}`);
  console.log(`Target Open VSX publisher: ${OVSX_PUBLISHER}`);

  if (pkg.publisher !== VSCE_PUBLISHER) {
    console.warn(
      `::warning::package.json publisher is "${pkg.publisher}" (expected "${VSCE_PUBLISHER}" for VS Code Marketplace)`
    );
  }

  const repacked = repackForOvsx(sourceVsix);
  console.log(
    `Repacked VSIX: publisher ${repacked.originalPublisher} → ${repacked.patchedPublisher}, version ${repacked.version}`
  );

  if (args.dryRun) {
    console.log("Dry run OK — manifest patched for lorapok-labs namespace.");
    rmSync(repacked.workDir, { recursive: true, force: true });
    return;
  }

  try {
    const output = publishVsix(repacked.outVsix, args.preRelease);
    if (output) process.stdout.write(output);
    console.log(`Published ${repacked.version} to Open VSX namespace ${OVSX_PUBLISHER}`);
  } catch (err) {
    const message = String(err.message ?? err);
    if (/already published/i.test(message)) {
      console.warn("::warning::Version already published on Open VSX (lorapok-labs) — treating as success");
      return;
    }
    throw err;
  } finally {
    rmSync(repacked.workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
