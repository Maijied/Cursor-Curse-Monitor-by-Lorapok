/**
 * Shared download total calculation for site-data generation and tests.
 */

export function compareSemver(a, b) {
  const normalize = (v) => v?.replace(/^v/, "") ?? "";
  if (!a || !b) return 0;
  const pa = normalize(a).split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = normalize(b).split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va === vb) continue;
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    return String(va).localeCompare(String(vb));
  }
  return 0;
}

/**
 * @param {{
 *   openVsxCanonical?: { version?: string | null; downloadCount?: number } | null;
 *   openVsxDuplicate?: { version?: string | null; downloadCount?: number } | null;
 *   vscode?: { downloadCount?: number } | null;
 *   githubAllAssets?: number;
 *   packageVersion?: string;
 * }} input
 */
export function computeDownloadTotals(input) {
  const canonical = input.openVsxCanonical ?? null;
  const duplicate = input.openVsxDuplicate ?? null;
  const packageVersion = input.packageVersion ?? null;

  const canonicalCount = canonical?.downloadCount ?? 0;
  const duplicateCount = duplicate?.downloadCount ?? 0;
  const vscodeCount = input.vscode?.downloadCount ?? 0;
  const githubAllAssets = input.githubAllAssets ?? 0;

  let openVsxSource = "canonical";
  let openVsxDisplayCount = canonicalCount;

  const canonicalBehindPackage =
    packageVersion &&
    canonical?.version &&
    compareSemver(canonical.version, packageVersion) < 0;
  const duplicateAheadCanonical =
    duplicate?.version &&
    canonical?.version &&
    compareSemver(duplicate.version, canonical.version) > 0;

  if (canonicalBehindPackage && duplicateAheadCanonical) {
    openVsxSource = "duplicate-fallback-display";
    openVsxDisplayCount = Math.max(canonicalCount, duplicateCount);
  }

  const displayTotal = openVsxDisplayCount + vscodeCount + githubAllAssets;
  const canonicalTotal = canonicalCount + vscodeCount + githubAllAssets;

  return {
    displayTotal,
    total: displayTotal,
    source: openVsxSource,
    breakdown: {
      openVsxCanonical: canonicalCount,
      openVsxDuplicate: duplicateCount,
      openVsxDisplay: openVsxDisplayCount,
      vscodeMarketplace: vscodeCount,
      githubAllAssets,
      githubVsix: githubAllAssets,
    },
    canonicalTotal,
  };
}
