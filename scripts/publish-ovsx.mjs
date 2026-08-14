#!/usr/bin/env node
/**
 * Publish to Open VSX under the canonical lorapok-labs namespace.
 *
 * package.json uses publisher "LorapokLabs" for VS Code Marketplace. Open VSX
 * reads Publisher from extension.vsixmanifest (and package.json). Both must be
 * patched before publish or the extension lands on the wrong namespace.
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
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const OVSX_PUBLISHER = "lorapok-labs";
const VSCE_PUBLISHER = "LorapokLabs";
const EXT_NAME = pkg.name;

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

function patchPublisherInVsixManifest(vsixManifestPath) {
  let xml = readFileSync(vsixManifestPath, "utf8");
  const before = xml;
  xml = xml.replace(/Publisher="[^"]+"/, `Publisher="${OVSX_PUBLISHER}"`);
  if (xml === before) {
    throw new Error("Could not patch Publisher in extension.vsixmanifest");
  }
  writeFileSync(vsixManifestPath, xml);
}

function repackForOvsx(sourceVsix) {
  const workDir = mkdtempSync(join(tmpdir(), "ovsx-repack-"));
  const extractDir = join(workDir, "extract");
  const outVsix = join(workDir, "ovsx-canonical.vsix");

  try {
    run("unzip", ["-q", sourceVsix, "-d", extractDir]);

    const packagePath = join(extractDir, "extension", "package.json");
    const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
    const originalPublisher = manifest.publisher;

    manifest.publisher = OVSX_PUBLISHER;
    writeFileSync(packagePath, JSON.stringify(manifest, null, 2) + "\n");

    patchPublisherInVsixManifest(join(extractDir, "extension.vsixmanifest"));

    run("zip", ["-qr", outVsix, ".", "-x", "*.DS_Store"], { cwd: extractDir });

    return {
      outVsix,
      workDir,
      version: manifest.version,
      originalPublisher,
      patchedPublisher: OVSX_PUBLISHER,
    };
  } catch (err) {
    rmSync(workDir, { recursive: true, force: true });
    throw err;
  }
}

async function fetchCanonicalVersion() {
  const res = await fetch(`https://open-vsx.org/api/${OVSX_PUBLISHER}/${EXT_NAME}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.version?.replace(/^v/, "") ?? null;
}

function publishVsix(vsixPath, preRelease) {
  const token = process.env.OVSX_PAT;
  if (!token) throw new Error("OVSX_PAT is not set");

  const nsResult = spawnSync("npx", ["ovsx", "create-namespace", OVSX_PUBLISHER, "-p", token], {
    encoding: "utf8",
  });
  const nsOutput = `${nsResult.stdout ?? ""}${nsResult.stderr ?? ""}`;
  if (nsResult.status !== 0 && !/already exists/i.test(nsOutput)) {
    throw new Error(`create-namespace failed: ${nsOutput.trim() || nsResult.status}`);
  }

  const publishArgs = ["ovsx", "publish", "-i", vsixPath, "-p", token];
  if (preRelease) publishArgs.push("--pre-release");

  const result = spawnSync("npx", publishArgs, { encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    throw new Error(output.trim() || `ovsx publish failed (${result.status})`);
  }
  return output;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceVsix = resolve(args.vsix ?? findDefaultVsix());

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
    const xml = readFileSync(
      join(repacked.workDir, "extract", "extension.vsixmanifest"),
      "utf8"
    );
    if (!xml.includes(`Publisher="${OVSX_PUBLISHER}"`)) {
      throw new Error("Dry run failed: extension.vsixmanifest publisher not patched");
    }
    console.log("Dry run OK — package.json and extension.vsixmanifest patched for lorapok-labs.");
    rmSync(repacked.workDir, { recursive: true, force: true });
    return;
  }

  try {
    const before = await fetchCanonicalVersion();
    const output = publishVsix(repacked.outVsix, args.preRelease);
    if (output) process.stdout.write(output);

    // Allow registry propagation
    await new Promise((r) => setTimeout(r, 3000));
    const after = await fetchCanonicalVersion();
    const target = repacked.version.replace(/^v/, "");

    if (after === target) {
      console.log(`Published ${target} to Open VSX namespace ${OVSX_PUBLISHER}`);
      return;
    }

    if (/already published/i.test(output) && after === target) {
      console.log(`Version ${target} already on canonical Open VSX listing`);
      return;
    }

    if (/already published/i.test(output) && before !== target && after !== target) {
      throw new Error(
        `ovsx reported "already published" but canonical ${OVSX_PUBLISHER} is still at ${after ?? "missing"} ` +
          `(expected ${target}). Version may be blocked by duplicate LorapokLabs listing — contact Open VSX support.`
      );
    }

    throw new Error(
      `Publish finished but canonical Open VSX version is ${after ?? "missing"} (expected ${target})`
    );
  } finally {
    rmSync(repacked.workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
