import { dispatchInfraWorkflow } from "./deploy-workflow.js";
import { readMailConfig } from "./mail-config.js";
import { getMailTransportStatus } from "./mail.js";

/**
 * Build actionable mail repair hints for Mission Control UI.
 * @param {ReturnType<typeof getMailTransportStatus>} transport
 * @param {ReturnType<import("./mail-config.js").normalizeMailConfig>} [mailConfig]
 */
export function buildMailSyncRecommendations(transport, mailConfig = {}) {
  const steps = [];
  const workersFree = mailConfig.workersFreeMode !== false;
  const domain = mailConfig.sendingDomain || "lorapok.tech";

  if (!transport.relayBound && !workersFree) {
    steps.push(
      "Sync up dispatches deploy-infra (admin only) to run enable-mail.mjs, verify transport, and redeploy Pages so MAIL_RELAY binds."
    );
  }

  if (!transport.resendConfigured) {
    steps.push(
      workersFree
        ? `Workers Free: configure RESEND_API_KEY for subscriber mail — verify ${domain} in Resend, then run node website/admin/scripts/setup-resend-secret.mjs`
        : "Configure RESEND_API_KEY for external recipients (Gmail, testmail.app): node website/admin/scripts/setup-resend-secret.mjs"
    );
  } else if (workersFree && !mailConfig.resendDomainVerified) {
    steps.push(
      `Confirm ${domain} is verified in Resend (SPF/DKIM DNS), then enable "Resend domain verified" in Settings → Outbound mail.`
    );
  }

  if (transport.transport === "cloudflare-rest" && transport.hint) {
    steps.push(transport.hint);
  }

  if (!transport.configured) {
    steps.push(
      "No outbound transport detected. After Sync up completes, send a branded test from Mailbox or run node website/admin/scripts/repair-mail.mjs locally."
    );
  }

  return steps;
}

/**
 * Trigger CI mail repair (enable-mail + verify + admin Pages deploy).
 * @param {Record<string, unknown>} env
 * @param {unknown} pagesContext
 * @param {string} triggeredBy
 */
export async function syncUpMailTransport(env, pagesContext, triggeredBy) {
  const transport = getMailTransportStatus(env);
  const recommendations = buildMailSyncRecommendations(transport, await readMailConfig(env));

  const dispatch = await dispatchInfraWorkflow(
    env,
    { deploy_admin: true, deploy_website: false },
    "Mail sync started — GitHub Actions will enable relay, verify transport, and redeploy Mission Control.",
    { triggeredBy },
    pagesContext
  );

  if (!dispatch.ok) {
    const payload = await dispatch.json().catch(() => ({}));
    return {
      ok: false,
      transport,
      recommendations,
      error: payload.error ?? "Mail sync dispatch failed",
      code: payload.code,
    };
  }

  const payload = await dispatch.json().catch(() => ({}));
  return {
    ok: true,
    transport,
    recommendations,
    workflow: payload.workflow ?? "ci-cd.yml",
    message: payload.message,
    deployAdmin: true,
    deployWebsite: false,
  };
}
