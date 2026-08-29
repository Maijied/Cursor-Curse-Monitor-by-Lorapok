import { readDiscordConfig } from "./discord-config.js";
import {
  buildDeployEnrichment,
  buildMarketplaceFields,
  formatDiscordCount,
  formatDownloadBreakdownText,
  formatEngagementText,
  normalizeTag,
} from "./discord-deploy-context.js";
import {
  buildDeploymentEmbed,
  buildSupplementalEmbeds,
} from "./discord-notify.js";
import { recordCronJobRun } from "./cron-schedule.js";
import {
  DISCORD_DIGEST_CONFIG_KEY,
  readDiscordDigestConfig,
} from "./discord-digest-config.js";
import {
  isStatsLiveCacheFresh,
  readStatsLiveCache,
} from "./stats-refresh-config.js";
import { fetchSiteDataWithLiveCache, runStatsRefresh } from "./stats-refresh.js";
import { logSystemEvent } from "./system-log.js";

/**
 * @param {Record<string, unknown>} env
 * @param {{ triggeredBy?: string; force?: boolean }} [options]
 */
export async function runDiscordDigest(env, options = {}) {
  const started = Date.now();
  const config = await readDiscordDigestConfig(env);

  if (!options.force && !config.enabled) {
    return { ok: false, skipped: true, reason: "disabled" };
  }
  if (!options.force && !config.lastRunAt) {
    // first run when enabled — allowed
  } else if (!options.force) {
    const last = Date.parse(String(config.lastRunAt));
    const due = Date.now() - last >= config.intervalMinutes * 60 * 1000;
    if (!due) {
      return {
        ok: false,
        skipped: true,
        reason: "not_due",
        intervalMinutes: config.intervalMinutes,
      };
    }
  }

  const discord = await readDiscordConfig(env);
  const webhookUrl = discord.deploymentWebhookUrl;
  if (!webhookUrl) {
    const message = "Deployment Discord webhook not configured";
    await recordCronJobRun(env, DISCORD_DIGEST_CONFIG_KEY, config, {
      ok: false,
      error: message,
      durationMs: Date.now() - started,
      triggeredBy: options.triggeredBy ?? "cron",
    });
    return { ok: false, skipped: true, reason: "no_webhook", error: message };
  }

  if (config.refreshBeforeSend) {
    const cache = await readStatsLiveCache(env);
    if (!isStatsLiveCacheFresh(cache)) {
      const refresh = await runStatsRefresh(env, {
        triggeredBy: options.triggeredBy ?? "discord-digest",
        force: true,
      });
      if (!refresh.ok && !refresh.skipped) {
        console.warn(
          "Discord digest: stats refresh before send failed",
          refresh.error ?? "unknown error"
        );
      }
    }
  }

  const siteData = await fetchSiteDataWithLiveCache(env);
  const tag =
    siteData?.github?.releaseTag ??
    (siteData?.version ? `v${String(siteData.version).replace(/^v/i, "")}` : null);

  let enrichment = null;
  try {
    enrichment = await buildDeployEnrichment(env, {
      tag,
      includeChangelog: config.includeChangelog,
    });
    if (siteData) {
      enrichment.siteData = siteData;
      enrichment.downloadBreakdown = formatDownloadBreakdownText(siteData);
      enrichment.engagement = formatEngagementText(siteData);
      enrichment.marketplaceFields = buildMarketplaceFields(siteData, enrichment.channels);
    }
  } catch (error) {
    console.warn("Discord digest enrichment failed", error);
  }

  const displayTotal = siteData?.downloads?.displayTotal ?? siteData?.downloads?.total;
  const syncStatus = siteData?.marketplaceSync?.syncStatus ?? siteData?.syncStatus ?? "unknown";
  const versionLabel = normalizeTag(tag) || siteData?.version || "—";

  const payload = {
    phase: "completed",
    actionType: "download-digest",
    conclusion: "success",
    tag: versionLabel,
    summary: [
      "Scheduled download & product update digest.",
      displayTotal != null
        ? `Verified community reach: **${formatDiscordCount(displayTotal)}** installs.`
        : null,
      `Marketplace sync: **${syncStatus}**.`,
    ]
      .filter(Boolean)
      .join("\n"),
    triggeredBy: options.triggeredBy ?? "cron",
  };

  const primary = buildDeploymentEmbed(payload, enrichment);
  primary.title = "📊 Download & update digest";
  const supplemental = buildSupplementalEmbeds(payload, enrichment);
  const embeds = [primary, ...supplemental].slice(0, 10);

  const branding = enrichment?.catalogBrand ?? {};
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Mission Control",
      avatar_url: branding.discordAvatarUrl ?? "https://cursor.lorapok.tech/assets/icon.png",
      embeds,
    }),
  });

  const durationMs = Date.now() - started;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const error = text.slice(0, 300) || `Discord webhook returned ${res.status}`;
    await recordCronJobRun(env, DISCORD_DIGEST_CONFIG_KEY, config, {
      ok: false,
      error,
      durationMs,
      triggeredBy: options.triggeredBy ?? "cron",
    });
    await logSystemEvent(env, {
      source: "discord-digest",
      level: "error",
      message: `Discord digest failed: ${error}`,
      meta: { durationMs },
    });
    return { ok: false, error, durationMs };
  }

  await recordCronJobRun(env, DISCORD_DIGEST_CONFIG_KEY, config, {
    ok: true,
    durationMs,
    triggeredBy: options.triggeredBy ?? "cron",
  });

  await logSystemEvent(env, {
    source: "discord-digest",
    level: "info",
    message: `Discord digest sent (${options.triggeredBy ?? "cron"})`,
    meta: {
      displayTotal,
      syncStatus,
      durationMs,
    },
  });

  return { ok: true, durationMs, displayTotal, syncStatus };
}
