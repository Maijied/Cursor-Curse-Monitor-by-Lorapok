import { dispatchInfraWorkflow } from "./deploy-workflow.js";
import { getMailTransportStatus } from "./mail.js";

/**
 * Build actionable mail repair hints for Mission Control UI.
 * @param {ReturnType<typeof getMailTransportStatus>} transport
 */
export function buildMailSyncRecommendations(transport) {
  const steps = [];

  if (!transport.relayBound) {
    steps.push(
      "Sync up dispatches deploy-infra (admin only) to run enable-mail.mjs, verify transport, and redeploy Pages so MAIL_RELAY binds."
    );
  }

  if (!transport.resendConfigured) {
    steps.push(
      "Configure RESEND_API_KEY for external recipients (Gmail, testmail.app): node website/admin/scripts/setup-resend-secret.mjs"
    );
  }

  if (transport.transport === "cloudflare-rest" && transport.hint) {
    steps.push(transport.hint);
  }

  if (!transport.configured) {
    steps.push(
      "No outbound transport detected. After Sync up completes, send a branded test from this page or run node website/admin/scripts/repair-mail.mjs locally."
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
  const recommendations = buildMailSyncRecommendations(transport);

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
