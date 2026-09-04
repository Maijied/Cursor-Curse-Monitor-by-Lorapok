import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { buildMailSyncRecommendations } from "../../_shared/mail-sync.js";
import { buildMailSetupInstructions } from "../../_shared/mail-setup-instructions.js";
import { readMailConfig, sanitizeMailConfigForClient } from "../../_shared/mail-config.js";
import { getMailTransportStatus } from "../../_shared/mail.js";
import { buildPublicSiteConfig } from "../../_shared/subscribe-config.js";

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
  const recommendations = buildMailSyncRecommendations(transport, config);
  const setupInstructions = buildMailSetupInstructions(config, transport);
  const subscribeSite = await buildPublicSiteConfig(env);

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
  });
}
