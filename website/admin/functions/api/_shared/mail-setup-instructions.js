/**
 * Shared Resend / Workers Free mail setup instructions for docs and Mission Control UI.
 * @param {ReturnType<import("./mail-config.js").normalizeMailConfig>} mailConfig
 * @param {ReturnType<import("./mail.js").getMailTransportStatus>} transport
 */
export function buildMailSetupInstructions(mailConfig, transport) {
  const domain = mailConfig.sendingDomain || "lorapok.tech";
  const resendReady = Boolean(transport.resendConfigured);
  const domainReady = Boolean(mailConfig.resendDomainVerified);

  return {
    guidePath: "docs/guides/RESEND_WORKERS_FREE_SETUP.md",
    workersFreeMode: mailConfig.workersFreeMode !== false,
    sendingDomain: domain,
    resendConfigured: resendReady,
    resendDomainVerified: domainReady,
    summary:
      "On Cloudflare Workers Free, outbound email to subscribers requires Resend. API keys stay in Pages secrets; routing and domain preferences are saved here in Mission Control.",
    steps: [
      {
        id: "rotate-resend-key",
        title: "Rotate Resend API key",
        description:
          "If a key was ever shared in chat or logs, revoke it in Resend → API Keys and create a new one.",
        link: "https://resend.com/api-keys",
        done: resendReady,
      },
      {
        id: "verify-domain",
        title: `Verify ${domain} in Resend`,
        description:
          "Add the domain in Resend, copy SPF/DKIM DNS records into Cloudflare DNS (grey cloud / DNS only), then click Verify in Resend.",
        link: "https://resend.com/domains",
        done: domainReady,
      },
      {
        id: "pages-secret",
        title: "Sync RESEND_API_KEY to Pages",
        description:
          "Push the key to the cursor-monitor-admin Pages project. Optional RESEND_FROM can match your verified domain.",
        command: "node website/admin/scripts/setup-resend-secret.mjs",
        done: resendReady,
      },
      {
        id: "github-secret",
        title: "Add RESEND_API_KEY to GitHub admin-production",
        description: "Lets deploy-infra keep Pages secrets in sync on workflow_dispatch.",
        command:
          'gh secret set RESEND_API_KEY --env admin-production --body "$(cred get cursor resend_api_key)"',
        done: false,
      },
      {
        id: "redeploy",
        title: "Redeploy Mission Control",
        description: "Pages must redeploy after secret changes. Use Sync up or deploy-infra.",
        command: "node website/admin/scripts/repair-mail.mjs",
        done: transport.configured,
      },
      {
        id: "verify-delivery",
        title: "Send a test to an external inbox",
        description: "Mailbox → branded test to Gmail, or run probe-subscribe-testmail.mjs.",
        command: "node website/admin/scripts/probe-subscribe-testmail.mjs",
        done: resendReady && domainReady && transport.configured,
      },
    ],
    secretsNote:
      "RESEND_API_KEY and RESEND_FROM are Cloudflare Pages secrets — they cannot be edited in this UI. Use setup-resend-secret.mjs or GitHub Actions deploy-infra.",
    configurableInAdmin: [
      "workersFreeMode",
      "resendFirstExternal",
      "sendingDomain",
      "resendFromOverride",
      "resendDomainVerified",
      "product/support From addresses and display names",
    ],
  };
}
