import { buildProductContext } from "./lib-product-context.mjs";

/**
 * @param {ReturnType<typeof buildProductContext>} ctx
 */
export function buildMailTemplates(ctx) {
  const v = ctx.version;
  return [
    {
      id: "invite-admin",
      label: "Admin invite",
      category: "invite",
      subject: "You're invited to Mission Control",
      text: `You've been invited to Mission Control for ${ctx.displayName}.\n\nOpen: ${ctx.adminUrl}\n\nSign in with your Google account or email magic link.`,
      variables: ["inviteUrl", "invitedBy"],
    },
    {
      id: "subscribe-welcome",
      label: "Subscribe confirmation",
      category: "subscribe",
      subject: "You're subscribed to CCM updates",
      text: `Thanks for subscribing to ${ctx.displayName} release updates from Lorapok Labs.\n\nWebsite: ${ctx.homepage}\nReply to unsubscribe.`,
      variables: ["email"],
    },
    {
      id: "support-response",
      label: "Support response",
      category: "support",
      subject: `Re: Your ${ctx.displayName} request`,
      text: `Thanks for reaching out to ${ctx.supportEmail}.

We've received your message and will follow up shortly. For faster help, include your extension version (v${v}), Cursor version, and steps to reproduce.

Help center: ${ctx.homepage}
Report a bug: ${ctx.feedbackUrl}`,
      variables: [],
    },
    {
      id: "warning-incident",
      label: "Warning — incident",
      category: "notice",
      severity: "warning",
      subject: "Service notice — action may be required",
      text: `We're investigating an issue affecting some ${ctx.displayName} users.

What you should know:
• Installed extensions may show stale usage until the next refresh
• Avoid triggering new deploys until we confirm recovery
• Track updates: ${ctx.collaborateUrl}

We apologize for the inconvenience.`,
      variables: ["title", "message"],
    },
    {
      id: "critical-security",
      label: "Critical — security",
      category: "notice",
      severity: "critical",
      subject: `Important security update — ${ctx.displayName} v${v}`,
      text: `Please update ${ctx.displayName} to v${v} or newer as soon as possible.

This release includes security hardening. Never paste API tokens into untrusted sites. Use only cursor.com/dashboard or the extension Options page.

Download: ${ctx.releaseUrl}
Support: ${ctx.supportEmail}`,
      variables: [],
    },
    {
      id: "bugfix-release",
      label: `Bug fix — v${v}`,
      category: "notice",
      severity: "info",
      subject: `${ctx.displayName} v${v} — bug fixes`,
      text: `We've released v${v} with bug fixes and stability improvements.

Update from your marketplace or GitHub: ${ctx.releaseUrl}

If a problem persists, reply with logs or open ${ctx.feedbackUrl}.`,
      variables: ["fixes"],
    },
    {
      id: "feature-release",
      label: `Feature release — v${v}`,
      category: "notice",
      severity: "info",
      subject: `${ctx.displayName} v${v} is here`,
      text: `v${v} is now available for ${ctx.displayName}.

Highlights include website stats polish, Firefox AMO compatibility, Mission Control deploy UX, and extension What's New popups.

Get it: ${ctx.releaseUrl}
Firefox: ${ctx.firefoxUrl}`,
      variables: ["highlights"],
    },
    {
      id: "release-notes",
      label: "Release notes broadcast",
      category: "notice",
      severity: "info",
      subject: `${ctx.displayName} v${v} release notes`,
      text: `A new version of ${ctx.displayName} (v${v}) is available from Lorapok Labs.

Read the full changelog on GitHub: ${ctx.releaseUrl}
Visit the product site: ${ctx.homepage}

Thank you for using CCM.`,
      variables: ["message"],
    },
    {
      id: "mailbox-test",
      label: "Mailbox delivery test",
      category: "test",
      subject: "Cursor Curse Monitor — mailbox test",
      text: `This is a live delivery test from Mission Control at ${new Date().toISOString()}.\n\nIf you received this, outbound mail from ${ctx.productEmail} is working.`,
      variables: ["email"],
    },
  ];
}
