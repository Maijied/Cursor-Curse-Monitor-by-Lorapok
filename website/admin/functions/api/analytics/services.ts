import { jsonResponse, verifyAdminRequest, requirePermission } from "../_shared/auth.js";
import { githubFetch } from "../_shared/github.js";
import { getMailTransportStatus } from "../_shared/mail.js";
import { readFirebaseConfig, isCompleteFirebaseConfig } from "../_shared/firebase-config.js";
import { probeAdminD1 } from "../_shared/d1-admin.js";
import { probeStatsR2 } from "../_shared/r2-stats.js";
import { readMailDeliverabilityState } from "../_shared/mail-deliverability-audit.js";
import { fetchSiteDataWithLiveCache } from "../_shared/stats-refresh.js";
import { readVisitorStatsMerged } from "../_shared/visitor-stats.js";
import { buildServiceQuotaSnapshot } from "../_shared/service-usage.js";
import { readStatsRefreshConfig, sanitizeStatsRefreshConfigForClient } from "../_shared/stats-refresh-config.js";
import { isKvWritesPaused } from "../_shared/kv-quota.js";
import { buildServiceAnalyticsHub } from "../_shared/service-analytics.js";

/**
 * ANALYTICS-01 — authenticated service analytics hub facade.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "settings.read");
  if (denied) return denied;

  let githubOk = false;
  try {
    const res = await githubFetch("/zen", env);
    githubOk = res.ok;
  } catch {
    githubOk = false;
  }

  const mail = getMailTransportStatus(env);
  const firebaseConfig = await readFirebaseConfig(env);
  const firebaseConfigured = Boolean(firebaseConfig && isCompleteFirebaseConfig(firebaseConfig));
  const adminD1 = await probeAdminD1(env);
  const statsR2 = await probeStatsR2(env);
  const mailDeliverability = await readMailDeliverabilityState(env);
  const visitors = await readVisitorStatsMerged(env);
  const siteData = await fetchSiteDataWithLiveCache(env);
  const statsConfig = sanitizeStatsRefreshConfigForClient(await readStatsRefreshConfig(env));
  const quotas = await buildServiceQuotaSnapshot(env, {
    resendConfigured: mail.resendConfigured ?? false,
    relayBound: mail.relayBound ?? false,
    restConfigured: mail.restConfigured ?? false,
  });
  const resendQuota = quotas.services?.find((s) => s.id === "resend");
  const gc = siteData?.githubCommunity ?? {};
  const downloads = siteData?.downloads ?? {};

  const hub = buildServiceAnalyticsHub({
    generatedAt: new Date().toISOString(),
    adminKvConfigured: Boolean(env.ADMIN_KV),
    statsR2,
    adminD1Configured: adminD1.configured,
    adminD1Ok: adminD1.ok,
    adminD1Error: adminD1.error ?? null,
    adminPublicUrl: env.ADMIN_PUBLIC_URL ?? "https://cursor-dev.lorapok.tech",
    firebaseConfigured,
    firebaseProject: firebaseConfig?.projectId ?? env.FIREBASE_PROJECT_ID ?? null,
    githubOk,
    githubTokenConfigured: Boolean(env.GITHUB_TOKEN),
    githubOpenIssues: gc.openIssues ?? null,
    githubStars: gc.stars ?? null,
    mailConfigured: mail.configured,
    mailTransport: mail.transport,
    mailResendConfigured: mail.resendConfigured ?? false,
    mailLastVerifiedAt: mailDeliverability.lastVerifiedAt ?? null,
    resendMonthlyUsed: resendQuota?.used ?? null,
    displayTotal: downloads.displayTotal ?? downloads.verifiedTotal ?? gc.totalDownloads ?? null,
    syncStatus: siteData?.syncStatus ?? null,
    packageVersion: siteData?.packageVersion ?? null,
    websiteVisits: visitors.websiteVisits ?? null,
    totalEngagement: visitors.totalEngagement ?? null,
    visitorSource: visitors.source ?? null,
    kvWritesPaused: isKvWritesPaused(statsConfig.writesPausedUntil),
    kvWritesPausedUntil: statsConfig.writesPausedUntil ?? null,
  });

  return jsonResponse({
    ok: true,
    ...hub,
    statsRefresh: {
      enabled: statsConfig.enabled,
      lastRunAt: statsConfig.lastRunAt ?? null,
      lastRunOk: statsConfig.lastRunOk ?? null,
    },
  });
}
