import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { buildMailSyncRecommendations } from "../../_shared/mail-sync.js";
import { buildMailSetupInstructions } from "../../_shared/mail-setup-instructions.js";
import { readMailConfig, sanitizeMailConfigForClient } from "../../_shared/mail-config.js";
import { getMailTransportStatus } from "../../_shared/mail.js";
import { buildPublicSiteConfig } from "../../_shared/subscribe-config.js";
import { maskEmail } from "../../_shared/mask-email.js";
import { readEmailIdentitiesConfig, sanitizeEmailIdentitiesForClient } from "../../_shared/email-identities-config.js";

/**
 * Aggregates mail transport readiness, identity config, sync recommendations, and subscribe gate status.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "mail.read");
  if (readDenied) return readDenied;

  const transport = getMailTransportStatus(env);
  const config = await readMailConfig(env);
  const sanitized = sanitizeMailConfigForClient(config, transport, env);
  const emailIdentities = await readEmailIdentitiesConfig(env);
  const sanitizedIdentities = sanitizeEmailIdentitiesForClient(emailIdentities);
  const inboundSummary = {
    domain: sanitizedIdentities.domain,
    opsForwardTo: sanitizedIdentities.opsForwardTo,
    routingApiConfigured: Boolean(
      env.CLOUDFLARE_ROUTING_API_TOKEN?.trim() ||
        env.CLOUDFLARE_API_TOKEN?.trim()
    ),
    mxNote:
      "lorapok.tech MX records must route through Cloudflare Email Routing (Dashboard → Email → Email Routing → enable).",
    identities: sanitizedIdentities.identities.map((item) => ({
      localPart: item.localPart,
      email: item.email,
      forwardTo: item.forwardTo,
      routingStatus: item.routingStatus,
      inboundReady: item.inboundReady === true,
      inboundNote: item.inboundNote ?? null,
      cloudflareRuleId: item.cloudflareRuleId,
    })),
    summary: {
      total: sanitizedIdentities.identities.length,
      inboundReady: sanitizedIdentities.identities.filter((item) => item.inboundReady === true).length,
      pending: sanitizedIdentities.identities.filter(
        (item) => !item.inboundReady && item.routingStatus !== "error"
      ).length,
      error: sanitizedIdentities.identities.filter((item) => item.routingStatus === "error").length,
    },
    syncCommand: "node website/admin/scripts/setup-email-addresses.mjs",
    verifyCommand: "node website/admin/scripts/verify-inbound-routing.mjs",
  };
  const recommendations = buildMailSyncRecommendations(transport, config, inboundSummary);
  const setupInstructions = buildMailSetupInstructions(config, transport);
  const subscribeSite = await buildPublicSiteConfig(env);
  const redirectRaw = String(env.MAIL_REDIRECT_TO ?? "").trim();

  return jsonResponse({
    ok: true,
    checkedAt: new Date().toISOString(),
    transport: {
      configured: transport.configured,
      transport: transport.transport ?? "none",
      relayBound: transport.relayBound ?? false,
      restConfigured: transport.restConfigured ?? false,
      resendConfigured: transport.resendConfigured ?? false,
      hint: transport.hint,
    },
    identities: {
      productEmail: sanitized.productEmail,
      supportEmail: sanitized.supportEmail,
      opsBccEmail: sanitized.opsBccEmail,
      productFromName: sanitized.productFromName,
      supportFromName: sanitized.supportFromName,
      resendFirstExternal: sanitized.resendFirstExternal,
      workersFreeMode: sanitized.workersFreeMode,
      sendingDomain: sanitized.sendingDomain,
      resendFromOverride: sanitized.resendFromOverride,
      resendDomainVerified: sanitized.resendDomainVerified,
      resendFromEnvConfigured: sanitized.resendFromEnvConfigured,
      testmailConfigured: sanitized.testmailConfigured,
      updatedAt: sanitized.updatedAt,
      updatedBy: sanitized.updatedBy,
    },
    setupInstructions,
    recommendations,
    mailConfigured: subscribeSite.mailConfigured,
    subscribeAvailable: subscribeSite.subscribeAvailable,
    subscribeModalEnabled: subscribeSite.subscribeModalEnabled,
    requireMailForSubscribe: subscribeSite.requireMailForSubscribe,
    redirect: {
      configured: Boolean(redirectRaw),
      address: redirectRaw ? redirectRaw.toLowerCase() : null,
      masked: redirectRaw ? maskEmail(redirectRaw) : null,
    },
    inbound: inboundSummary,
  });
}
