/**
 * Edge-compatible download totals (mirrors scripts/download-totals.mjs).
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
 *   githubAllAssets?: number | null;
 *   packageVersion?: string;
 * }} input
 */
export function computeDownloadTotals(input) {
  const canonical = input.openVsxCanonical ?? null;
  const duplicate = input.openVsxDuplicate ?? null;
  const packageVersion = input.packageVersion ?? null;

  const canonicalLive = Boolean(canonical);
  const duplicateLive = Boolean(duplicate);
  const vscodeLive = input.vscode != null;
  const githubLive = input.githubAllAssets != null;

  const canonicalCount = canonicalLive ? (canonical.downloadCount ?? 0) : null;
  const duplicateCount = duplicateLive ? (duplicate.downloadCount ?? 0) : null;
  const vscodeCount = vscodeLive ? (input.vscode.downloadCount ?? 0) : null;
  const githubAllAssets = githubLive ? input.githubAllAssets : null;

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

  if (
    canonicalBehindPackage &&
    duplicateAheadCanonical &&
    canonicalCount != null &&
    duplicateCount != null
  ) {
    openVsxSource = "duplicate-fallback-display";
    openVsxDisplayCount = Math.max(canonicalCount, duplicateCount);
  }

  const verified = canonicalLive && githubLive && vscodeLive;
  const openVsxCombined =
    canonicalCount != null && duplicateLive && duplicateCount != null
      ? canonicalCount + duplicateCount
      : canonicalCount;

  const displayTotal = verified
    ? (canonicalCount ?? 0) +
      (duplicateLive && duplicateCount != null ? duplicateCount : 0) +
      (vscodeCount ?? 0) +
      githubAllAssets
    : null;
  const canonicalTotal =
    canonicalCount != null && githubAllAssets != null
      ? canonicalCount + (vscodeCount ?? 0) + githubAllAssets
      : null;

  return {
    displayTotal,
    total: displayTotal,
    verified,
    openVsxCombined,
    source: openVsxSource,
    liveSources: {
      openVsxCanonical: canonicalLive,
      openVsxDuplicate: duplicateLive,
      vscodeMarketplace: vscodeLive,
      githubReleases: githubLive,
    },
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
