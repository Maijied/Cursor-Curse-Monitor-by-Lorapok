import { jsonResponse } from "./_shared/auth.js";
import { githubFetch } from "./_shared/github.js";
import { getMailTransportStatus } from "./_shared/mail.js";
import { readFirebaseConfig, isCompleteFirebaseConfig } from "./_shared/firebase-config.js";
import { probeAdminD1 } from "./_shared/d1-admin.js";
import { readDiscordConfig, sanitizeDiscordConfigForClient } from "./_shared/discord-config.js";
import { buildPublicSiteConfig } from "./_shared/subscribe-config.js";
import {
  readStatsRefreshConfig,
  sanitizeStatsRefreshConfigForClient,
} from "./_shared/stats-refresh-config.js";
import {
  readDiscordDigestConfig,
  sanitizeDiscordDigestConfigForClient,
} from "./_shared/discord-digest-config.js";

/**
 * Reports service health, configuration status, and endpoint URLs.
 *
 * @param context - The request context containing environment bindings.
 * @returns A JSON response with health checks and sanitized service configuration.
 */
export async function onRequestGet(context) {
  const { env } = context;
  const checks = { github: false, timestamp: new Date().toISOString() };

  try {
    const res = await githubFetch("/zen", env);
    checks.github = res.ok;
  } catch {
    checks.github = false;
  }

  const mail = getMailTransportStatus(env);
  const firebaseConfig = await readFirebaseConfig(env);
  const firebaseConfigured = Boolean(firebaseConfig && isCompleteFirebaseConfig(firebaseConfig));
  const adminD1 = await probeAdminD1(env);
  const subscribeSite = await buildPublicSiteConfig(env);
  const discordConfig = sanitizeDiscordConfigForClient(await readDiscordConfig(env));
  const statsRefresh = sanitizeStatsRefreshConfigForClient(await readStatsRefreshConfig(env));
  const discordDigest = sanitizeDiscordDigestConfigForClient(await readDiscordDigestConfig(env));

  return jsonResponse({
    ok: checks.github,
    checks,
    firebaseProject: firebaseConfig?.projectId ?? env.FIREBASE_PROJECT_ID ?? "cursor-curse-by-lorapok",
    firebaseConfigured,
    adminD1Configured: adminD1.configured,
    adminD1Ok: adminD1.ok,
    adminD1Error: adminD1.error ?? null,
    githubTokenConfigured: Boolean(env.GITHUB_TOKEN),
    adminKvConfigured: Boolean(env.ADMIN_KV),
    mailConfigured: mail.configured,
    mailTransport: mail.transport,
    mailRelayBound: mail.relayBound ?? false,
    mailRestConfigured: mail.restConfigured ?? false,
    mailResendConfigured: mail.resendConfigured ?? false,
    mailHint: mail.hint,
    subscribeAvailable: subscribeSite.subscribeAvailable,
    subscribeModalEnabled: subscribeSite.subscribeModalEnabled,
    subscribeFallbackMode: subscribeSite.subscribeFallbackMode,
    discordConfigured: discordConfig.deploymentConfigured ?? discordConfig.configured,
    feedbackDiscordConfigured: discordConfig.feedbackConfigured,
    communityDiscordConfigured: discordConfig.communityConfigured,
    communityDiscordInviteUrl: discordConfig.communityInviteUrl,
    statsRefreshEnabled: statsRefresh.enabled,
    statsRefreshIntervalMinutes: statsRefresh.intervalMinutes,
    statsRefreshLastRunAt: statsRefresh.lastRunAt,
    discordDigestEnabled: discordDigest.enabled,
    discordDigestIntervalMinutes: discordDigest.intervalMinutes,
    discordDigestLastRunAt: discordDigest.lastRunAt,
    cronSecretConfigured: Boolean(env.CRON_SECRET),
    adminPublicUrl: env.ADMIN_PUBLIC_URL ?? "https://cursor-dev.lorapok.tech",
    siteDataUrl:
      env.SITE_DATA_URL ??
      "https://cursor.lorapok.tech/site-data.json",
  });
}
