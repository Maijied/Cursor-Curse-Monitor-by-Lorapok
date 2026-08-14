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

async function fetchVersion(namespace) {
  const versionsUrl = `https://open-vsx.org/api/${namespace}/${EXT_NAME}/versions`;
  try {
    const res = await fetch(versionsUrl, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = await res.json();
      const keys = Object.keys(data?.versions ?? {});
      if (keys.length > 0) {
        keys.sort((a, b) => compareSemver(b, a));
        return keys[0];
      }
    }
  } catch {
    /* fall through */
  }

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

async function main() {
  const strict = process.argv.includes("--strict");
  const [canonical, duplicate] = await Promise.all([
    fetchVersion(OVSX_CANONICAL),
    fetchVersion(OVSX_DUPLICATE),
  ]);

  console.log(`Package version:        ${TARGET_VERSION}`);
  console.log(`Open VSX canonical:     ${canonical ?? "missing"} (${OVSX_CANONICAL})`);
  console.log(`Open VSX duplicate:     ${duplicate ?? "missing"} (${OVSX_DUPLICATE})`);

  let failed = false;

  if (canonical == null) {
    console.error(`::error::Canonical Open VSX listing missing for ${OVSX_CANONICAL}/${EXT_NAME}`);
    failed = true;
  } else if (compareSemver(canonical, TARGET_VERSION) < 0) {
    console.error(
      `::error::Canonical Open VSX (${canonical}) is behind package.json (${TARGET_VERSION}). ` +
        `Run node scripts/publish-ovsx.mjs after npm run package.`
    );
    failed = true;
  }

  if (canonical != null && duplicate != null && compareSemver(duplicate, canonical) > 0) {
    console.error(
      `::error::Duplicate listing ${OVSX_DUPLICATE} (${duplicate}) is ahead of canonical ` +
        `${OVSX_CANONICAL} (${canonical}). Stop publishing bare ovsx publish; use publish-ovsx.mjs only.`
    );
    failed = true;
  }

  if (duplicate != null && canonical != null && duplicate !== canonical) {
    console.warn(
      `::warning::Duplicate Open VSX namespace ${OVSX_DUPLICATE} still exists at v${duplicate}. ` +
        `Request deprecation from Open VSX/Eclipse Foundation.`
    );
  }

  if (failed) {
    if (strict) process.exit(1);
    console.warn("::warning::Marketplace sync check failed (non-strict mode)");
    return;
  }

  console.log("Marketplace sync check passed.");
}

main();
