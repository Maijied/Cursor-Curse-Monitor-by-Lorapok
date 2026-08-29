import { GITHUB_REPO } from "./repo-constants.js";
import { computeDownloadTotals } from "./download-totals.js";
import { fetchLiveChannels } from "./live-channels.js";
import { fetchSiteData } from "./site-data.js";
import {
  readStatsLiveCache,
  readStatsRefreshConfig,
  STATS_README_SVG_KEY,
  STATS_REFRESH_CACHE_KEY,
  STATS_REFRESH_CONFIG_KEY,
} from "./stats-refresh-config.js";
import { recordCronJobRun } from "./cron-schedule.js";
import { logSystemEvent } from "./system-log.js";
import {
  buildReadmeStatsFromSiteData,
  renderReadmeStatsSvg,
  renderShieldsBadge,
} from "./readme-stats.js";

async function fetchGithubReleaseDownloadTotal(env) {
  const headers = env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" }
    : { Accept: "application/json" };
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`, {
    headers,
  });
  if (!res.ok) return null;
  const releases = await res.json();
  if (!Array.isArray(releases)) return null;
  return releases.reduce((sum, rel) => {
    const assets = rel.assets ?? [];
    return sum + assets.reduce((a, asset) => a + (asset.download_count ?? 0), 0);
  }, 0);
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
  if (cache.downloads) merged.downloads = cache.downloads;
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
    fetchGithubReleaseDownloadTotal(env),
    fetchVisitorStats(env),
  ]);

  const ovsxCanonical = channelById(channels, "ovsx-canonical");
  const ovsxDuplicate = channelById(channels, "ovsx-duplicate");
  const vscodeChannel = channelById(channels, "vscode");
  const firefox = channelById(channels, "firefox-amo");
  const packageVersion = String(base.packageVersion ?? base.version ?? "").replace(/^v/i, "");

  const downloads = computeDownloadTotals({
    openVsxCanonical: ovsxCanonical
      ? { version: ovsxCanonical.version, downloadCount: ovsxCanonical.downloadCount ?? 0 }
      : null,
    openVsxDuplicate: ovsxDuplicate
      ? { version: ovsxDuplicate.version, downloadCount: ovsxDuplicate.downloadCount ?? 0 }
      : null,
    vscode: vscodeChannel ? { downloadCount: vscodeChannel.downloadCount ?? 0 } : null,
    githubAllAssets,
    packageVersion,
  });

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

  await env.ADMIN_KV.put(STATS_REFRESH_CACHE_KEY, JSON.stringify(snapshot));

  const mergedSiteData = mergeSiteDataWithLiveCache(base, snapshot);
  const readmeStats = buildReadmeStatsFromSiteData(mergedSiteData);
  await Promise.all([
    env.ADMIN_KV.put(STATS_README_SVG_KEY, renderReadmeStatsSvg(readmeStats)),
    env.ADMIN_KV.put("stats:badge:total", JSON.stringify(renderShieldsBadge(readmeStats, "total"))),
    env.ADMIN_KV.put("stats:badge:openvsx", JSON.stringify(renderShieldsBadge(readmeStats, "openvsx"))),
    env.ADMIN_KV.put(
      "stats:badge:openvsx-total",
      JSON.stringify(renderShieldsBadge(readmeStats, "openvsx-total"))
    ),
    env.ADMIN_KV.put("stats:badge:vscode", JSON.stringify(renderShieldsBadge(readmeStats, "vscode"))),
  ]);

  const durationMs = Date.now() - started;
  await recordCronJobRun(env, STATS_REFRESH_CONFIG_KEY, config, {
    ok: true,
    durationMs,
    triggeredBy: options.triggeredBy ?? "manual",
    at: snapshot.refreshedAt,
  });

  await logSystemEvent(env, {
    source: "stats-refresh",
    level: "info",
    message: `Live stats refreshed (${options.triggeredBy ?? "manual"})`,
    meta: {
      verified: downloads.verified,
      displayTotal: downloads.displayTotal,
      durationMs,
      syncStatus: marketplaceSync.syncStatus,
    },
  });

  return { ok: true, snapshot, durationMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refresh failed";
    const durationMs = Date.now() - started;
    await recordCronJobRun(env, STATS_REFRESH_CONFIG_KEY, config, {
      ok: false,
      error: message,
      durationMs,
      triggeredBy: options.triggeredBy ?? "manual",
    });
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
  return mergeSiteDataWithLiveCache(base, cache);
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
