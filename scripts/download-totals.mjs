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
 * Summarize GitHub release asset download_count fields (dynamic).
 * @param {Array<{ draft?: boolean; prerelease?: boolean; assets?: Array<{ name?: string; download_count?: number }> }>} releases
 */
export function summarizeGithubReleaseAssets(releases) {
  if (!Array.isArray(releases)) {
    return {
      githubAllAssets: null,
      githubVsix: null,
      githubChrome: null,
      githubXpi: null,
      latestReleaseVsix: null,
      latestReleaseChrome: null,
      latestReleaseXpi: null,
    };
  }

  let githubAllAssets = 0;
  let githubVsix = 0;
  let githubChrome = 0;
  let githubXpi = 0;

  for (const rel of releases) {
    for (const asset of rel.assets ?? []) {
      const count = Number(asset.download_count ?? 0) || 0;
      githubAllAssets += count;
      const name = String(asset.name ?? "");
      if (name.endsWith(".vsix")) githubVsix += count;
      else if (/chrome/i.test(name) && name.endsWith(".zip")) githubChrome += count;
      else if (name.endsWith(".xpi")) githubXpi += count;
    }
  }

  const latest =
    releases.find((r) => !r.draft && !r.prerelease) ||
    releases.find((r) => !r.draft) ||
    releases[0] ||
    null;

  let latestReleaseVsix = 0;
  let latestReleaseChrome = 0;
  let latestReleaseXpi = 0;
  if (latest) {
    for (const asset of latest.assets ?? []) {
      const count = Number(asset.download_count ?? 0) || 0;
      const name = String(asset.name ?? "");
      if (name.endsWith(".vsix")) latestReleaseVsix = count;
      else if (/chrome/i.test(name) && name.endsWith(".zip")) latestReleaseChrome = count;
      else if (name.endsWith(".xpi")) latestReleaseXpi = count;
    }
  }

  return {
    githubAllAssets,
    githubVsix,
    githubChrome,
    githubXpi,
    latestReleaseVsix,
    latestReleaseChrome,
    latestReleaseXpi,
  };
}

/**
 * @param {{
 *   openVsxCanonical?: { version?: string | null; downloadCount?: number } | null;
 *   openVsxDuplicate?: { version?: string | null; downloadCount?: number } | null;
 *   vscode?: { downloadCount?: number } | null;
 *   githubAllAssets?: number | null;
 *   githubVsix?: number | null;
 *   githubChrome?: number | null;
 *   latestReleaseVsix?: number | null;
 *   latestReleaseChrome?: number | null;
 *   firefoxAmo?: {
 *     weeklyDownloads?: number | null;
 *     averageDailyUsers?: number | null;
 *     downloadCount?: number | null;
 *     url?: string | null;
 *     published?: boolean;
 *   } | null;
 *   packageVersion?: string;
 * }} input
 */
export function computeDownloadTotals(input) {
  const canonical = input.openVsxCanonical ?? null;
  const duplicate = input.openVsxDuplicate ?? null;
  const packageVersion = input.packageVersion ?? null;
  const firefoxAmo = input.firefoxAmo ?? null;

  const canonicalLive = Boolean(canonical);
  const duplicateLive = Boolean(duplicate);
  const vscodeLive = input.vscode != null;
  const githubLive = input.githubAllAssets != null;
  const firefoxLive = firefoxAmo != null;

  const canonicalCount = canonicalLive ? (canonical.downloadCount ?? 0) : null;
  const duplicateCount = duplicateLive ? (duplicate.downloadCount ?? 0) : null;
  const vscodeCount = vscodeLive ? (input.vscode.downloadCount ?? 0) : null;
  const githubAllAssets = githubLive ? input.githubAllAssets : null;
  const githubVsix = input.githubVsix != null ? Number(input.githubVsix) : null;
  const githubChrome = input.githubChrome != null ? Number(input.githubChrome) : null;
  const latestReleaseVsix =
    input.latestReleaseVsix != null ? Number(input.latestReleaseVsix) : null;
  const latestReleaseChrome =
    input.latestReleaseChrome != null ? Number(input.latestReleaseChrome) : null;

  // AMO public API exposes weekly_downloads + average_daily_users, not lifetime totals.
  const firefoxWeekly =
    firefoxLive && firefoxAmo.weeklyDownloads != null
      ? Number(firefoxAmo.weeklyDownloads)
      : firefoxLive
        ? 0
        : null;
  const firefoxDailyUsers =
    firefoxLive && firefoxAmo.averageDailyUsers != null
      ? Number(firefoxAmo.averageDailyUsers)
      : firefoxLive
        ? 0
        : null;
  const firefoxLifetime =
    firefoxLive && firefoxAmo.downloadCount != null ? Number(firefoxAmo.downloadCount) : null;

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

  // Verified when core marketplace + GitHub channels are live. Firefox AMO is additive
  // (listed in breakdown) but does not block verification — AMO has no public lifetime total.
  const verified = canonicalLive && githubLive && vscodeLive;
  const openVsxCombined =
    canonicalCount != null && duplicateLive && duplicateCount != null
      ? canonicalCount + duplicateCount
      : canonicalCount;

  const firefoxInTotal = firefoxLifetime != null ? firefoxLifetime : 0;

  const displayTotal = verified
    ? (canonicalCount ?? 0) +
      (duplicateLive && duplicateCount != null ? duplicateCount : 0) +
      (vscodeCount ?? 0) +
      githubAllAssets +
      firefoxInTotal
    : null;
  const canonicalTotal =
    canonicalCount != null && githubAllAssets != null
      ? canonicalCount + (vscodeCount ?? 0) + githubAllAssets + firefoxInTotal
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
      firefoxAmo: firefoxLive,
    },
    breakdown: {
      openVsxCanonical: canonicalCount,
      openVsxDuplicate: duplicateCount,
      openVsxDisplay: openVsxDisplayCount,
      vscodeMarketplace: vscodeCount,
      githubAllAssets,
      githubVsix,
      githubChrome,
      latestReleaseVsix,
      latestReleaseChrome,
      firefoxAmoWeekly: firefoxWeekly,
      firefoxAmoDailyUsers: firefoxDailyUsers,
      firefoxAmoLifetime: firefoxLifetime,
    },
    canonicalTotal,
  };
}

/**
 * Keep last verified download totals when a live refresh cannot verify all channels.
 * Also preserve Open VSX duplicate counts when the duplicate registry briefly 404s/times out
 * while core channels still verify (otherwise Total silently drops ~15k).
 * @param {Record<string, unknown>|null|undefined} previousDownloads
 * @param {ReturnType<typeof computeDownloadTotals>} nextTotals
 */
export function preserveVerifiedDownloads(previousDownloads, nextTotals) {
  let merged = nextTotals;

  const prevDup = previousDownloads?.breakdown?.openVsxDuplicate;
  const nextDupMissing =
    merged.liveSources?.openVsxDuplicate === false || merged.breakdown?.openVsxDuplicate == null;
  if (
    previousDownloads?.liveSources?.openVsxDuplicate &&
    prevDup != null &&
    nextDupMissing &&
    merged.breakdown?.openVsxCanonical != null
  ) {
    const canonical = Number(merged.breakdown.openVsxCanonical) || 0;
    const duplicate = Number(prevDup) || 0;
    const vscode = Number(merged.breakdown.vscodeMarketplace) || 0;
    const github = Number(merged.breakdown.githubAllAssets) || 0;
    const firefoxLifetime =
      merged.breakdown.firefoxAmoLifetime != null ? Number(merged.breakdown.firefoxAmoLifetime) : 0;
    const displayTotal = canonical + duplicate + vscode + github + firefoxLifetime;
    merged = {
      ...merged,
      openVsxCombined: canonical + duplicate,
      displayTotal,
      total: displayTotal,
      canonicalTotal: canonical + vscode + github + firefoxLifetime,
      liveSources: { ...merged.liveSources, openVsxDuplicate: true },
      breakdown: {
        ...merged.breakdown,
        openVsxDuplicate: duplicate,
      },
    };
  }

  if (previousDownloads?.verified !== true || merged.verified) return merged;
  return {
    ...merged,
    displayTotal: previousDownloads.displayTotal ?? previousDownloads.total ?? null,
    total: previousDownloads.total ?? previousDownloads.displayTotal ?? null,
    verified: true,
    liveSources: {
      ...(previousDownloads.liveSources ?? {}),
      ...merged.liveSources,
      openVsxCanonical:
        merged.liveSources?.openVsxCanonical ||
        previousDownloads.liveSources?.openVsxCanonical ||
        false,
      vscodeMarketplace:
        merged.liveSources?.vscodeMarketplace ||
        previousDownloads.liveSources?.vscodeMarketplace ||
        false,
      githubReleases:
        merged.liveSources?.githubReleases ||
        previousDownloads.liveSources?.githubReleases ||
        false,
    },
    breakdown: {
      ...(previousDownloads.breakdown ?? {}),
      ...(merged.breakdown ?? {}),
      openVsxCanonical:
        merged.breakdown?.openVsxCanonical ?? previousDownloads.breakdown?.openVsxCanonical ?? null,
      openVsxDuplicate:
        merged.breakdown?.openVsxDuplicate ?? previousDownloads.breakdown?.openVsxDuplicate ?? null,
      vscodeMarketplace:
        merged.breakdown?.vscodeMarketplace ?? previousDownloads.breakdown?.vscodeMarketplace ?? null,
      githubAllAssets:
        merged.breakdown?.githubAllAssets ?? previousDownloads.breakdown?.githubAllAssets ?? null,
    },
    canonicalTotal: previousDownloads.canonicalTotal ?? merged.canonicalTotal,
    openVsxCombined: previousDownloads.openVsxCombined ?? merged.openVsxCombined,
    source: previousDownloads.source ?? merged.source,
    note: previousDownloads.note ?? merged.note,
  };
}
