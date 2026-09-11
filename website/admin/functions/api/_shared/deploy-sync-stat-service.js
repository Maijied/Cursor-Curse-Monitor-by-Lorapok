import { fetchLiveChannels } from "./live-channels.js";
import {
  buildMarketplaceFields,
  formatDownloadBreakdownText,
  formatEngagementText,
  normalizeTag,
} from "./discord-deploy-context.js";
import { fetchSiteDataWithLiveCache } from "./stats-refresh.js";

/**
 * @param {string|null|undefined} tag
 * @returns {string|null}
 */
export function normalizeDeployVersion(tag) {
  if (tag == null) return null;
  const raw = String(tag).trim();
  if (!raw || raw === "0.0.0") return null;
  return raw.replace(/^v/i, "").split("-")[0];
}

/**
 * Overlay the deployed release tag onto site-data so Discord cards match the pipeline version.
 * @param {Record<string, unknown>|null|undefined} siteData
 * @param {string|null|undefined} deployedTag
 * @returns {Record<string, unknown>|null|undefined}
 */
export function applyDeployedVersionOverlay(siteData, deployedTag) {
  const version = normalizeDeployVersion(deployedTag);
  if (!version || !siteData) return siteData ?? null;

  const releaseTag = normalizeTag(deployedTag);
  return {
    ...siteData,
    packageVersion: version,
    version: version,
    publishedReleaseVersion: version,
    github: {
      ...(siteData.github ?? {}),
      releaseTag,
    },
    marketplaceSync: {
      ...(siteData.marketplaceSync ?? {}),
      packageVersion: version,
      checkedAt: new Date().toISOString(),
    },
  };
}

/**
 * @param {string} packageVersion
 * @param {Array<Record<string, unknown>>|null|undefined} channels
 * @returns {"synced"|"drift"|"unknown"}
 */
export function resolveMarketplaceSyncStatus(packageVersion, channels) {
  const target = normalizeDeployVersion(packageVersion);
  if (!target) return "unknown";
  if (!Array.isArray(channels) || channels.length === 0) return "unknown";

  const comparable = channels.filter((channel) => channel.id !== "package" && !channel.warn);
  if (!comparable.length) return "unknown";

  const synced = comparable.every(
    (channel) => String(channel.version ?? "").replace(/^v/i, "").split("-")[0] === target,
  );
  return synced ? "synced" : "drift";
}

/**
 * @param {Record<string, unknown>|null|undefined} siteData
 * @param {Array<Record<string, unknown>>|null|undefined} channels
 * @param {{ deployedTag?: string|null }} [options]
 */
export function buildDeploySyncStatPayload(siteData, channels, options = {}) {
  const deployedTag = options.deployedTag ?? null;
  const mergedSiteData = applyDeployedVersionOverlay(siteData, deployedTag);
  const packageVersion =
    normalizeDeployVersion(deployedTag) ??
    normalizeDeployVersion(mergedSiteData?.packageVersion ?? mergedSiteData?.version) ??
    null;

  const syncStatus =
    (packageVersion && channels?.length
      ? resolveMarketplaceSyncStatus(packageVersion, channels)
      : null) ??
    mergedSiteData?.marketplaceSync?.syncStatus ??
    mergedSiteData?.syncStatus ??
    "unknown";

  const siteDataForFields = mergedSiteData
    ? {
        ...mergedSiteData,
        syncStatus,
        marketplaceSync: {
          ...(mergedSiteData.marketplaceSync ?? {}),
          packageVersion: packageVersion ?? mergedSiteData.marketplaceSync?.packageVersion ?? null,
          syncStatus,
        },
      }
    : null;

  const ovsxVersion =
    channels?.find((channel) => channel.id === "ovsx-canonical")?.version ??
    siteDataForFields?.ovsx?.version ??
    null;
  const duplicateVersion =
    channels?.find((channel) => channel.id === "ovsx-duplicate")?.version ??
    siteDataForFields?.ovsxDuplicate?.version ??
    null;
  const vscodeVersion =
    channels?.find((channel) => channel.id === "vscode")?.version ??
    siteDataForFields?.vscode?.version ??
    null;
  const firefoxVersion =
    channels?.find((channel) => channel.id === "firefox-amo")?.version ??
    siteDataForFields?.browserExtension?.firefox?.version ??
    null;

  return {
    deployedVersion: deployedTag ? normalizeTag(deployedTag) : null,
    packageVersion,
    githubReleaseTag: siteDataForFields?.github?.releaseTag ?? null,
    syncStatus,
    marketplaceVersions: {
      ovsx: ovsxVersion,
      ovsxDuplicate: duplicateVersion,
      vscode: vscodeVersion,
      firefox: firefoxVersion,
    },
    downloads: siteDataForFields?.downloads ?? null,
    engagement: siteDataForFields?.visitors ?? null,
    siteData: siteDataForFields,
    channels: channels ?? null,
    marketplaceFields: buildMarketplaceFields(siteDataForFields, channels),
    downloadBreakdown: formatDownloadBreakdownText(siteDataForFields),
    engagementText: formatEngagementText(siteDataForFields),
  };
}

/**
 * Single source of truth for Discord deploy cards — same live cache path as Mission Control.
 * @param {Record<string, unknown>} env
 * @param {{ deployedTag?: string|null; refreshChannels?: boolean }} [options]
 */
export async function fetchDeploySyncStat(env, options = {}) {
  let siteData = null;
  try {
    siteData = await fetchSiteDataWithLiveCache(env);
  } catch (error) {
    console.warn("deploy-sync-stat: site-data unavailable", error);
  }

  let channels = null;
  if (siteData && options.refreshChannels !== false) {
    try {
      const overlayData = applyDeployedVersionOverlay(siteData, options.deployedTag) ?? siteData;
      channels = await fetchLiveChannels(overlayData, { githubToken: env.GITHUB_TOKEN });
    } catch (error) {
      console.warn("deploy-sync-stat: live channels unavailable", error);
      channels = siteData?.liveChannels ?? siteData?.channels ?? null;
    }
  }

  return buildDeploySyncStatPayload(siteData, channels, options);
}

/**
 * Headless sync-stat builder for CI scripts (no KV/network).
 * @param {Record<string, unknown>|null|undefined} siteData
 * @param {{ deployedTag?: string|null }} [options]
 */
export function buildLocalDeploySyncStat(siteData, options = {}) {
  const channels = siteData?.liveChannels ?? siteData?.channels ?? null;
  return buildDeploySyncStatPayload(siteData, channels, options);
}
