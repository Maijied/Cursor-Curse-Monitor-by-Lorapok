import { GITHUB_REPO } from "./repo-constants.js";
import { computeDownloadTotals, preserveVerifiedDownloads } from "./download-totals.js";
import { fetchLiveChannels } from "./live-channels.js";
import { fetchSiteData } from "./site-data.js";
import {
  readStatsLiveCache,
  readStatsRefreshConfig,
  STATS_BADGES_BUNDLE_KEY,
  STATS_README_SVG_KEY,
  STATS_REFRESH_CACHE_KEY,
  STATS_REFRESH_CONFIG_KEY,
} from "./stats-refresh-config.js";
import { recordCronJobRun } from "./cron-schedule.js";
import { formatKvPutError, putKvJsonIfChanged, putKvStringIfChanged } from "./kv-put.js";
import { writeStatsArtifactsR2 } from "./r2-stats.js";
import { isKvQuotaError, isKvWritesPaused, nextUtcQuotaResetIso } from "./kv-quota.js";
import { logSystemEvent } from "./system-log.js";
import {
  buildReadmeStatsFromSiteData,
  renderReadmeStatsSvg,
  renderShieldsBadge,
} from "./readme-stats.js";

/** @param {Record<string, unknown>} snapshot */
function stableSnapshotBody(snapshot) {
  const { refreshedAt: _refreshedAt, triggeredBy: _triggeredBy, ...rest } = snapshot;
  return rest;
}

async function fetchGithubReleaseDownloadTotal(env, base = null) {
  const headers = env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" }
    : { Accept: "application/json" };
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100`, {
      headers,
    });
    if (!res.ok) return githubReleaseFallback(base);
    const releases = await res.json();
    if (!Array.isArray(releases)) return githubReleaseFallback(base);
    const total = releases.reduce((sum, rel) => {
      const assets = rel.assets ?? [];
      return sum + assets.reduce((a, asset) => a + (asset.download_count ?? 0), 0);
    }, 0);
    return total > 0 ? total : githubReleaseFallback(base);
  } catch {
    return githubReleaseFallback(base);
  }
}

/** @param {Record<string, unknown>|null|undefined} base */
function githubReleaseFallback(base) {
  const breakdown = base?.downloads?.breakdown;
  if (breakdown != null && "githubAllAssets" in breakdown) {
    return breakdown.githubAllAssets != null ? Number(breakdown.githubAllAssets) : null;
  }
  const fromGithub = base?.github?.totalReleaseDownloads ?? base?.github?.allAssetsDownloadCount;
  if (fromGithub != null) return Number(fromGithub);
  return null;
}

async function fetchVisitorStats(env) {
  const url = typeof env.ANALYTICS_STATS_URL === "string" ? env.ANALYTICS_STATS_URL.trim() : "";
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function channelById(channels, id) {
  return channels.find((c) => c.id === id) ?? null;
}

const STALE_CACHE_MS = 60 * 60 * 1000;

/**
 * @param {Record<string, unknown>|null|undefined} cache
 * @param {number} [maxAgeMs]
 */
export function isStatsCacheStale(cache, maxAgeMs = STALE_CACHE_MS) {
  if (!cache?.refreshedAt) return true;
  const refreshedAt = Date.parse(String(cache.refreshedAt));
  if (Number.isNaN(refreshedAt)) return true;
  return Date.now() - refreshedAt > maxAgeMs;
}

/**
 * Lightweight read-path overlay when KV cache is missing or stale (no KV write).
 * @param {Record<string, unknown>} base
 * @param {Array<Record<string, unknown>>} channels
 */
export function buildEphemeralChannelOverlay(base, channels) {
  const ovsxCanonical = channelById(channels, "ovsx-canonical");
  const ovsxDuplicate = channelById(channels, "ovsx-duplicate");
  const vscodeChannel = channelById(channels, "vscode");
  const firefox = channelById(channels, "firefox-amo");
  const packageVersion = String(base.packageVersion ?? base.version ?? "").replace(/^v/i, "");
  const target = packageVersion;

  const marketplaceSync = {
    packageVersion: target,
    syncStatus: channels
      .filter((c) => c.id !== "package" && !c.warn)
      .every((c) => c.version === target)
      ? "synced"
      : "drift",
    checkedAt: new Date().toISOString(),
  };

  const liveVersions = channels
    .filter((c) => c.id !== "package" && c.version)
    .map((c) => String(c.version).replace(/^v/i, "").split("-")[0])
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v));

  const newestLive = liveVersions.sort((a, b) => {
    const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
    const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
      const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }).at(-1);

  const overlay = {
    refreshedAt: new Date().toISOString(),
    channels,
    marketplaceSync,
    ovsx: {
      version: ovsxCanonical?.version ?? base.ovsx?.version ?? null,
      downloadCount: ovsxCanonical?.downloadCount ?? base.ovsx?.downloadCount ?? 0,
    },
    ovsxDuplicate: {
      version: ovsxDuplicate?.version ?? base.ovsxDuplicate?.version ?? null,
      downloadCount: ovsxDuplicate?.downloadCount ?? base.ovsxDuplicate?.downloadCount ?? 0,
    },
    vscode: {
      version: vscodeChannel?.version ?? base.vscode?.version ?? null,
      downloadCount: vscodeChannel?.downloadCount ?? base.vscode?.downloadCount ?? 0,
    },
    github: {
      releaseTag: channelById(channels, "github-release")?.version
        ? `v${channelById(channels, "github-release").version}`
        : base.github?.releaseTag ?? null,
    },
    browserExtension: {
      firefox: {
        published: firefox?.published ?? base.browserExtension?.firefox?.published ?? false,
        version: firefox?.version ?? base.browserExtension?.firefox?.version ?? null,
      },
    },
    ...(newestLive ? { livePackageVersion: newestLive } : {}),
  };

  return overlay;
}

/**
 * @param {Record<string, unknown>} merged
 * @param {Record<string, unknown>} overlay
 */
function applyLivePackageVersion(merged, overlay) {
  const liveVersion = overlay.livePackageVersion;
  if (!liveVersion || typeof liveVersion !== "string") return merged;

  const baseVersion = String(merged.packageVersion ?? merged.version ?? "")
    .replace(/^v/i, "")
    .split("-")[0];
  const compare = (a, b) => {
    const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
    const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
      const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };

  if (!baseVersion || compare(liveVersion, baseVersion) > 0) {
    return {
      ...merged,
      packageVersion: liveVersion,
      version: liveVersion,
      syncStatus: overlay.marketplaceSync?.syncStatus ?? merged.syncStatus,
    };
  }
  return merged;
}

/**
 * Merge live KV cache over static site-data for Mission Control dashboards.
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>|null} cache
 */
export function mergeSiteDataWithLiveCache(base, cache) {
  if (!cache) return base;
  const merged = { ...base };
  if (cache.refreshedAt) {
    merged.liveRefreshedAt = cache.refreshedAt;
    const baseAt = base.generatedAt ? Date.parse(String(base.generatedAt)) : 0;
    const liveAt = Date.parse(String(cache.refreshedAt));
    if (!Number.isNaN(liveAt) && (Number.isNaN(baseAt) || liveAt > baseAt)) {
      merged.generatedAt = cache.refreshedAt;
    }
  }
  if (cache.downloads) {
    merged.downloads = preserveVerifiedDownloads(base.downloads, cache.downloads);
  }
  if (cache.channels) merged.liveChannels = cache.channels;
  if (cache.marketplaceSync) merged.marketplaceSync = cache.marketplaceSync;
  if (cache.visitors) merged.visitors = { ...(base.visitors ?? {}), ...cache.visitors };
  if (cache.ovsx) merged.ovsx = { ...(base.ovsx ?? {}), ...cache.ovsx };
  if (cache.ovsxDuplicate) merged.ovsxDuplicate = { ...(base.ovsxDuplicate ?? {}), ...cache.ovsxDuplicate };
  if (cache.vscode) merged.vscode = { ...(base.vscode ?? {}), ...cache.vscode };
  if (cache.github) merged.github = { ...(base.github ?? {}), ...cache.github };
  if (cache.browserExtension) {
    merged.browserExtension = { ...(base.browserExtension ?? {}), ...cache.browserExtension };
  }
  return merged;
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ triggeredBy?: string; force?: boolean }} [options]
 */
export async function runStatsRefresh(env, options = {}) {
  const started = Date.now();
  const config = await readStatsRefreshConfig(env);
  if (!options.force && !config.enabled) {
    return { ok: false, skipped: true, reason: "disabled" };
  }
  if (!options.force && isKvWritesPaused(config.writesPausedUntil)) {
    return {
      ok: false,
      skipped: true,
      reason: "kv_writes_paused",
      writesPausedUntil: config.writesPausedUntil,
    };
  }
  if (!options.force && config.lastRunAt) {
    const last = Date.parse(config.lastRunAt);
    const due = Date.now() - last >= config.intervalMinutes * 60 * 1000;
    if (!due) {
      return { ok: false, skipped: true, reason: "not_due", nextDueAt: new Date(last + config.intervalMinutes * 60 * 1000).toISOString() };
    }
  }

  try {
  const base = await fetchSiteData(env);
  const [channels, githubAllAssets, visitors] = await Promise.all([
    fetchLiveChannels(base, { githubToken: env.GITHUB_TOKEN }),
    fetchGithubReleaseDownloadTotal(env, base),
    fetchVisitorStats(env),
  ]);

  const ovsxCanonical = channelById(channels, "ovsx-canonical");
  const ovsxDuplicate = channelById(channels, "ovsx-duplicate");
  const vscodeChannel = channelById(channels, "vscode");
  const firefox = channelById(channels, "firefox-amo");
  const packageVersion = String(base.packageVersion ?? base.version ?? "").replace(/^v/i, "");

  const downloads = preserveVerifiedDownloads(
    base.downloads,
    computeDownloadTotals({
      openVsxCanonical: ovsxCanonical
        ? { version: ovsxCanonical.version, downloadCount: ovsxCanonical.downloadCount ?? 0 }
        : null,
      openVsxDuplicate: ovsxDuplicate
        ? { version: ovsxDuplicate.version, downloadCount: ovsxDuplicate.downloadCount ?? 0 }
        : null,
      vscode: vscodeChannel ? { downloadCount: vscodeChannel.downloadCount ?? 0 } : null,
      githubAllAssets,
      packageVersion,
    }),
  );

  const target = packageVersion;
  const marketplaceSync = {
    packageVersion: target,
    syncStatus: channels
      .filter((c) => c.id !== "package" && !c.warn)
      .every((c) => c.version === target)
      ? "synced"
      : "drift",
    checkedAt: new Date().toISOString(),
  };

  const snapshot = {
    refreshedAt: new Date().toISOString(),
    baseGeneratedAt: base.generatedAt ?? null,
    triggeredBy: options.triggeredBy ?? "manual",
    downloads,
    channels,
    marketplaceSync,
    visitors: visitors ?? base.visitors ?? null,
    ovsx: {
      ...(base.ovsx ?? {}),
      version: ovsxCanonical?.version ?? base.ovsx?.version ?? null,
      downloadCount: ovsxCanonical?.downloadCount ?? base.ovsx?.downloadCount ?? 0,
    },
    ovsxDuplicate: {
      ...(base.ovsxDuplicate ?? {}),
      version: ovsxDuplicate?.version ?? base.ovsxDuplicate?.version ?? null,
      downloadCount: ovsxDuplicate?.downloadCount ?? base.ovsxDuplicate?.downloadCount ?? 0,
    },
    vscode: {
      ...(base.vscode ?? {}),
      version: vscodeChannel?.version ?? base.vscode?.version ?? null,
      downloadCount: vscodeChannel?.downloadCount ?? base.vscode?.downloadCount ?? 0,
    },
    github: {
      ...(base.github ?? {}),
      releaseTag: channelById(channels, "github-release")?.version
        ? `v${channelById(channels, "github-release").version}`
        : base.github?.releaseTag ?? null,
      allAssetsDownloadCount: githubAllAssets,
    },
    browserExtension: {
      ...(base.browserExtension ?? {}),
      firefox: {
        ...(base.browserExtension?.firefox ?? {}),
        published: firefox?.published ?? base.browserExtension?.firefox?.published ?? false,
        version: firefox?.version ?? base.browserExtension?.firefox?.version ?? null,
      },
    },
  };

  if (!env.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }

  const previous = await readStatsLiveCache(env);
  const statsChanged =
    !previous || JSON.stringify(stableSnapshotBody(previous)) !== JSON.stringify(stableSnapshotBody(snapshot));
  let artifactsStorage = null;

  if (statsChanged) {
    await putKvJsonIfChanged(env, STATS_REFRESH_CACHE_KEY, snapshot);

    const prevTotal = previous?.downloads?.displayTotal;
    const nextTotal = snapshot.downloads?.displayTotal;
    const displayTotalChanged = prevTotal !== nextTotal;
    const syncStatusChanged =
      previous?.marketplaceSync?.syncStatus !== snapshot.marketplaceSync?.syncStatus;

    if (displayTotalChanged || syncStatusChanged) {
      const mergedSiteData = mergeSiteDataWithLiveCache(base, snapshot);
      const readmeStats = buildReadmeStatsFromSiteData(mergedSiteData);
      const badgeBundle = {
        total: renderShieldsBadge(readmeStats, "total"),
        openvsx: renderShieldsBadge(readmeStats, "openvsx"),
        "openvsx-total": renderShieldsBadge(readmeStats, "openvsx-total"),
        vscode: renderShieldsBadge(readmeStats, "vscode"),
      };
      const svg = renderReadmeStatsSvg(readmeStats);
      const r2Written = await writeStatsArtifactsR2(env, { svg, badgeBundle });
      const artifactsStorage = r2Written ? "r2" : "kv";
      if (!r2Written) {
        await Promise.all([
          putKvStringIfChanged(env, STATS_README_SVG_KEY, svg),
          putKvJsonIfChanged(env, STATS_BADGES_BUNDLE_KEY, badgeBundle),
        ]);
      }
    }
  }

  const durationMs = Date.now() - started;
  await recordCronJobRun(env, STATS_REFRESH_CONFIG_KEY, config, {
    ok: true,
    durationMs,
    triggeredBy: options.triggeredBy ?? "manual",
    at: snapshot.refreshedAt,
  });

  if (statsChanged) {
    await logSystemEvent(env, {
      source: "stats-refresh",
      level: "info",
      message: `Live stats refreshed (${options.triggeredBy ?? "manual"})`,
      meta: {
        verified: downloads.verified,
        displayTotal: downloads.displayTotal,
        durationMs,
        syncStatus: marketplaceSync.syncStatus,
        ...(artifactsStorage ? { artifactsStorage } : {}),
      },
    });
  }

  return { ok: true, snapshot, durationMs, statsChanged };
  } catch (err) {
    const message = formatKvPutError(err);
    const durationMs = Date.now() - started;
    const pauseUntil = isKvQuotaError(err) ? nextUtcQuotaResetIso() : null;
    try {
      await recordCronJobRun(env, STATS_REFRESH_CONFIG_KEY, config, {
        ok: false,
        error: message,
        durationMs,
        triggeredBy: options.triggeredBy ?? "manual",
        writesPausedUntil: pauseUntil,
      });
    } catch {
      // KV quota may block run metadata too
    }
    await logSystemEvent(env, {
      source: "stats-refresh",
      level: "error",
      message: `Live stats refresh failed: ${message}`,
      meta: { durationMs, triggeredBy: options.triggeredBy ?? "manual" },
    });
    return { ok: false, error: message, durationMs };
  }
}

/**
 * @param {Record<string, unknown>} env
 */
export async function fetchSiteDataWithLiveCache(env) {
  const [base, cache] = await Promise.all([fetchSiteData(env), readStatsLiveCache(env)]);

  if (!isStatsCacheStale(cache)) {
    return mergeSiteDataWithLiveCache(base, cache);
  }

  try {
    const channels = await fetchLiveChannels(base, { githubToken: env.GITHUB_TOKEN });
    const overlay = buildEphemeralChannelOverlay(base, channels);
    return applyLivePackageVersion(mergeSiteDataWithLiveCache(base, overlay), overlay);
  } catch (err) {
    console.error("fetchSiteDataWithLiveCache ephemeral overlay failed", err);
    return mergeSiteDataWithLiveCache(base, cache);
  }
}

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 */
export function verifyCronSecret(request, env) {
  const expected = typeof env.CRON_SECRET === "string" ? env.CRON_SECRET.trim() : "";
  if (!expected) return { ok: false, reason: "cron_secret_not_configured" };
  const header = request.headers.get("X-Cron-Secret") ?? request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  if (!token || token !== expected) return { ok: false, reason: "unauthorized" };
  return { ok: true };
}
