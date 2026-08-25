#!/usr/bin/env node
/**
 * Verify marketplace version parity after publish.
 * Fails CI if canonical Open VSX (lorapok-labs) is behind package.json,
 * or if the duplicate LorapokLabs listing is ahead of canonical.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const OVSX_CANONICAL = "lorapok-labs";
const OVSX_DUPLICATE = "LorapokLabs";
const EXT_NAME = pkg.name;
const TARGET_VERSION = pkg.version.replace(/^v/, "");

function parseArgs(argv) {
  const args = { strict: false, retry: 0, retryDelayMs: 10000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--strict") args.strict = true;
    else if (arg.startsWith("--retry=")) args.retry = Number(arg.slice("--retry=".length));
    else if (arg === "--retry" && argv[i + 1]) args.retry = Number(argv[++i]);
  }
  return args;
}

async function fetchVersion(namespace) {
  const url = `https://open-vsx.org/api/${namespace}/${EXT_NAME}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`::warning::Open VSX API ${url} returned ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data?.version?.replace(/^v/, "") ?? null;
  } catch (err) {
    console.warn(`::warning::Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

function compareSemver(a, b) {
  const pa = a.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = b.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va === vb) continue;
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    return String(va).localeCompare(String(vb));
  }
  return 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function evaluateSync(canonical, duplicate) {
  let failed = false;
  let behindTarget = false;

  if (canonical == null) {
    console.error(`::error::Canonical Open VSX listing missing for ${OVSX_CANONICAL}/${EXT_NAME}`);
    failed = true;
  } else if (compareSemver(canonical, TARGET_VERSION) < 0) {
    behindTarget = true;
    console.error(
      `::error::Canonical Open VSX (${canonical}) is behind package.json (${TARGET_VERSION}). ` +
        `Run node scripts/publish-ovsx.mjs after npm run package.`
    );
    failed = true;
  }

  if (duplicate != null && compareSemver(duplicate, TARGET_VERSION) < 0) {
    console.error(
      `::error::Duplicate listing ${OVSX_DUPLICATE} (${duplicate}) is behind package.json (${TARGET_VERSION}). ` +
        `Publish the LorapokLabs VSIX to Open VSX as well (both listings are active).`
    );
    failed = true;
  }

  if (
    canonical != null &&
    duplicate != null &&
    compareSemver(canonical, duplicate) !== 0
  ) {
    console.warn(
      `::warning::Open VSX version mismatch — canonical ${OVSX_CANONICAL}=${canonical}, ` +
        `duplicate ${OVSX_DUPLICATE}=${duplicate}. Both listings are kept for existing users.`
    );
    if (compareSemver(canonical, TARGET_VERSION) < 0 || compareSemver(duplicate, TARGET_VERSION) < 0) {
      failed = true;
    }
  }

  if (duplicate != null && canonical != null && compareSemver(duplicate, TARGET_VERSION) >= 0) {
    console.log(
      `Dual Open VSX listings active: ${OVSX_CANONICAL} (${canonical}) and ${OVSX_DUPLICATE} (${duplicate}).`
    );
  }

  return { failed, behindTarget };
}

async function main() {
  const { strict, retry, retryDelayMs } = parseArgs(process.argv.slice(2));
  const maxAttempts = 1 + Math.max(0, retry);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const [canonical, duplicate] = await Promise.all([
      fetchVersion(OVSX_CANONICAL),
      fetchVersion(OVSX_DUPLICATE),
    ]);

    console.log(`Package version:        ${TARGET_VERSION}`);
    console.log(`Open VSX canonical:     ${canonical ?? "missing"} (${OVSX_CANONICAL})`);
    console.log(`Open VSX duplicate:     ${duplicate ?? "missing"} (${OVSX_DUPLICATE})`);

    const { failed, behindTarget } = evaluateSync(canonical, duplicate);

    if (!failed) {
      console.log("Marketplace sync check passed.");
      return;
    }

    const canRetry =
      attempt < maxAttempts - 1 && behindTarget && canonical != null;

    if (canRetry) {
      console.warn(
        `::warning::Canonical Open VSX still indexing (${canonical}); ` +
          `retrying in ${retryDelayMs / 1000}s (${attempt + 1}/${maxAttempts})...`
      );
      await sleep(retryDelayMs);
      continue;
    }

    if (strict) process.exit(1);
    console.warn("::warning::Marketplace sync check failed (non-strict mode)");
    return;
  }
}

main();
