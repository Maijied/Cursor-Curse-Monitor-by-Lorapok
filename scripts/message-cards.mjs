/**
 * Shared message cards for email, in-extension notices, and Discord.
 * Build-time source for embed-product-context.mjs.
 */
import { buildProductContext } from "./lib-product-context.mjs";

/**
 * @param {ReturnType<typeof buildProductContext>} ctx
 */
export function buildMessageBranding(ctx) {
  const site = ctx.homepage.replace(/\/$/, "");
  return {
    mainLogoUrl: `${site}/assets/logo.png`,
    mainLogoAlt: ctx.displayName,
    discordAvatarUrl: `${site}/assets/logo.png`,
    discordAuthorName: "Lorapok Mission Control",
    discordFooterText: "cursor.lorapok.tech · Mission Control",
    emailTagline: "Cursor Curse Monitor · Mission Control",
    emailFromName: "Cursor Curse Monitor",
  };
}

/**
 * @param {ReturnType<typeof buildProductContext>} ctx
 */
export function buildChannelFooters(ctx) {
  return {
    email: {
      feedbackCta: "Send feedback",
      helpCta: "Get help",
      collaborateCta: "Join discussions",
      unsubscribeHint: "Reply to this email any time to unsubscribe from product updates.",
      supportLine: `Questions? ${ctx.supportEmail}`,
    },
    discord: {
      feedbackBlock: [
        `💬 **Feedback** — [GitHub Issues](${ctx.feedbackUrl})`,
        `💡 **Discuss** — [GitHub Discussions](${ctx.collaborateUrl})`,
        `🆘 **Support** — ${ctx.supportEmail}`,
      ].join("\n"),
      productBlock: [
        `🌐 [Product site](${ctx.homepage})`,
        `🛠️ [Mission Control](${ctx.adminUrl})`,
        `📦 [Latest release](${ctx.releaseUrl})`,
      ].join(" · "),
      deploySuccessHint: "Share feedback in GitHub Issues if anything looks off after this deploy.",
    },
    notice: {
      feedbackLabel: "Send feedback",
      collaborateLabel: "Community discussions",
    },
  };
}

/**
 * @param {ReturnType<typeof buildProductContext>} ctx
 */
export function buildMessageCards(ctx) {
  const v = ctx.releaseVersion ?? ctx.version;
  const now = new Date().toISOString();

  /** @type {Array<Record<string, unknown>>} */
  const cards = [
    {
      id: "invite-admin",
      label: "Admin invite",
      category: "invite",
      channels: {
        email: {
          subject: "You're invited to Mission Control",
          text: `You've been invited to Mission Control for ${ctx.displayName}.\n\nOpen: ${ctx.adminUrl}\n\nSign in with your Google account or email magic link.`,
          variables: ["inviteUrl", "invitedBy"],
        },
      },
    },
    {
      id: "subscribe-welcome",
      label: "Subscribe confirmation",
      category: "subscribe",
      channels: {
        email: {
          subject: "You're subscribed to CCM updates",
          text: `Thanks for subscribing to ${ctx.displayName} release updates from Lorapok Labs.\n\nWebsite: ${ctx.homepage}\n${buildChannelFooters(ctx).email.unsubscribeHint}`,
          variables: ["email"],
        },
        notice: {
          type: "info",
          severity: "info",
          dismissible: true,
          title: "You're subscribed to release updates",
          shortMessage: "We'll email you when new CCM builds ship from Lorapok Labs.",
          message: `You're on the list for ${ctx.displayName} updates. Manage preferences by replying to any product email or visiting ${ctx.homepage}.`,
        },
      },
    },
    {
      id: "support-response",
      label: "Support response",
      category: "support",
      channels: {
        email: {
          subject: `Re: Your ${ctx.displayName} request`,
          text: `Thanks for reaching out to ${ctx.supportEmail}.\n\nWe've received your message and will follow up shortly. For faster help, include your extension version (v${v}), Cursor version, and steps to reproduce.\n\nHelp center: ${ctx.homepage}\nReport a bug: ${ctx.feedbackUrl}`,
          variables: [],
        },
      },
    },
    {
      id: "warning-incident",
      label: "Warning — incident",
      category: "notice",
      severity: "warning",
      channels: {
        email: {
          subject: "Service notice — action may be required",
          text: `We're investigating an issue affecting some ${ctx.displayName} users.\n\nWhat you should know:\n• Installed extensions may show stale usage until the next refresh\n• Avoid triggering new deploys until we confirm recovery\n• Track updates: ${ctx.collaborateUrl}\n\nWe apologize for the inconvenience.`,
          variables: ["title", "message"],
        },
        notice: {
          type: "incident",
          severity: "warning",
          dismissible: false,
          title: "Service incident — we're on it",
          shortMessage: "Some users may see stale usage data until we confirm recovery.",
          message: `We're investigating an active incident. Refresh the dashboard after we post an all-clear notice. Follow ${ctx.collaborateUrl} for live updates.`,
        },
        discord: {
          title: "⚠️ Service incident",
          summary: "Mission Control is tracking an incident. Extension usage may be stale until recovery.",
        },
      },
    },
    {
      id: "critical-security",
      label: "Critical — security",
      category: "notice",
      severity: "critical",
      channels: {
        email: {
          subject: `Important security update — ${ctx.displayName} v${v}`,
          text: `Please update ${ctx.displayName} to v${v} or newer as soon as possible.\n\nThis release includes security hardening. Never paste API tokens into untrusted sites. Use only cursor.com/dashboard or the extension Options page.\n\nDownload: ${ctx.releaseUrl}\nSupport: ${ctx.supportEmail}`,
          variables: [],
        },
        notice: {
          type: "security",
          severity: "warning",
          dismissible: false,
          title: "Security update recommended",
          shortMessage: "Update to the latest release for token-handling hardening.",
          message: `Update to v${v} or newer. Re-paste tokens only via cursor.com/dashboard or Options — never in chat or email. Report concerns at ${ctx.feedbackUrl}.`,
        },
        discord: {
          title: "🔒 Security advisory",
          summary: `Users should update ${ctx.displayName} to v${v} or newer.`,
        },
      },
    },
    {
      id: "bugfix-release",
      label: `Bug fix — v${v}`,
      category: "notice",
      severity: "info",
      channels: {
        email: {
          subject: `${ctx.displayName} v${v} — bug fixes`,
          text: `We've released v${v} with bug fixes and stability improvements.\n\nUpdate from your marketplace or GitHub: ${ctx.releaseUrl}\n\nIf a problem persists, reply with logs or open ${ctx.feedbackUrl}.`,
          variables: ["fixes"],
        },
        notice: {
          type: "maintenance",
          severity: "info",
          dismissible: true,
          title: `Bug fixes in v${v}`,
          shortMessage: `Patch v${v} addresses reported issues. Update when convenient.`,
          message: `We've shipped v${v} with stability fixes. Update from your marketplace or ${ctx.releaseUrl}. Still stuck? ${ctx.feedbackUrl}`,
        },
      },
    },
    {
      id: "feature-release",
      label: `Feature release — v${v}`,
      category: "feature",
      severity: "info",
      channels: {
        email: {
          subject: `${ctx.displayName} v${v} is here`,
          text: `v${v} is now available for ${ctx.displayName}.\n\nHighlights include dashboard settings modal, unified message cards for email and Discord, and agent conversation recovery tools.\n\nGet it: ${ctx.releaseUrl}\nFirefox: ${ctx.firefoxUrl}`,
          variables: ["highlights"],
        },
        notice: {
          type: "feature",
          severity: "info",
          dismissible: true,
          title: `What's new in Cursor Curse Monitor v${v}`,
          shortMessage: `v${v} adds dashboard settings, shared notification cards, and polish across Mission Control.`,
          message: `Cursor Curse Monitor v${v} is rolling out across Open VSX, VS Code Marketplace, Firefox AMO, and GitHub Releases.\n\nUpdate: ${ctx.releaseUrl}`,
        },
        discord: {
          title: "✨ Feature release",
          summary: `v${v} is live — check Mission Control for marketplace sync status.`,
        },
      },
    },
    {
      id: "release-notes",
      label: "Release notes broadcast",
      category: "notice",
      severity: "info",
      channels: {
        email: {
          subject: `${ctx.displayName} v${v} release notes`,
          text: `A new version of ${ctx.displayName} (v${v}) is available from Lorapok Labs.\n\nRead the full changelog on GitHub: ${ctx.releaseUrl}\nVisit the product site: ${ctx.homepage}\n\nThank you for using CCM.`,
          variables: ["message"],
        },
      },
    },
    {
      id: "mailbox-test",
      label: "Mailbox delivery test",
      category: "test",
      channels: {
        email: {
          subject: "Cursor Curse Monitor — mailbox test",
          text: `This is a live delivery test from Mission Control at ${now}.\n\nIf you received this, outbound mail from ${ctx.productEmail} is working.`,
          variables: ["email"],
        },
      },
    },
    {
      id: "conversation-recovery",
      label: "Conversation recovery (agent editor)",
      category: "feature",
      severity: "info",
      channels: {
        notice: {
          id: "conversation-recovery-v0515",
          source: "release",
          type: "feature",
          severity: "info",
          dismissible: true,
          title: "Recover missing agent conversations",
          shortMessage:
            "Lost chats after a worktree switch? Reindex from the dashboard — transcripts from Aug 10+ are restored safely.",
          message:
            "If your agent sidebar lost chats after a worktree switch, branch change, or workspace path mismatch, open the CCM dashboard and run **Reindex missing conversations**. Quit the editor first — the tool rebuilds indexes from on-disk agent transcripts without deleting existing data.",
        },
        discord: {
          title: "🧠 Agent conversation recovery",
          summary: "CCM can rebuild orphaned agent chats from local transcripts after worktree switches.",
        },
      },
    },
    {
      id: "quota-warning",
      label: "Usage quota warning",
      category: "warning",
      severity: "warning",
      channels: {
        notice: {
          type: "usage",
          severity: "warning",
          dismissible: true,
          title: "Approaching your usage cap",
          shortMessage: "CCM detected high usage this cycle — review budget settings or enable fallback model.",
          message:
            "Your Cursor usage is nearing the configured warning threshold. Open the dashboard to review spend, set a personal budget cap, or enable Composer 2.5 fallback before you hit the limit.",
        },
        discord: {
          title: "📈 Usage advisory",
          summary: "Remind beta testers to watch budget caps and fallback model settings in CCM.",
        },
      },
    },
    {
      id: "agent-editor-tip",
      label: "Agent editor integration tip",
      category: "info",
      severity: "info",
      channels: {
        notice: {
          type: "feature",
          severity: "info",
          dismissible: true,
          title: "CCM + Cursor Agent",
          shortMessage:
            "Keep the dashboard open while agents run — usage, security scan, and conversation recovery stay in sync.",
          message: `While Cursor Agent edits your repo, CCM monitors API usage locally, scans for leaked secrets on save, and can recover missing agent threads after worktree changes. Open **Settings** in the dashboard to tune polling and notices.`,
        },
      },
    },
    {
      id: "beta-tester-invite",
      label: "Beta channel invite",
      category: "invite",
      severity: "info",
      channels: {
        email: {
          subject: `You're invited to CCM beta builds — v${v}`,
          text: `You've been invited to test pre-release builds of ${ctx.displayName}.\n\nInstall the latest VSIX from GitHub Actions or ${ctx.releaseUrl}\n\nSend feedback: ${ctx.feedbackUrl}`,
          variables: [],
        },
        notice: {
          type: "development",
          severity: "info",
          dismissible: true,
          title: "Beta builds available",
          shortMessage: "Try the latest VSIX from GitHub Actions and share feedback before marketplace publish.",
          message: `Beta builds ship through GitHub Actions before Open VSX and VS Marketplace. Report issues at ${ctx.feedbackUrl}.`,
        },
        discord: {
          title: "🧪 Beta invite",
          summary: "New beta VSIX ready for testers — check Actions artifacts and Mission Control deploy notes.",
        },
      },
    },
    {
      id: "feedback-thanks",
      label: "Feedback received",
      category: "response",
      severity: "info",
      channels: {
        email: {
          subject: `Thanks for your ${ctx.displayName} feedback`,
          text: `We received your feedback — thank you for helping improve ${ctx.displayName}.\n\nIf you included steps to reproduce, we'll follow up at ${ctx.supportEmail}.\n\nTrack requests: ${ctx.feedbackUrl}`,
          variables: [],
        },
        discord: {
          title: "💬 Feedback reminder",
          summary: buildChannelFooters(ctx).discord.feedbackBlock,
        },
      },
    },
    {
      id: "incident-resolved",
      label: "Incident resolved",
      category: "notice",
      severity: "info",
      channels: {
        email: {
          subject: "All clear — service restored",
          text: `The recent ${ctx.displayName} incident is resolved. Refresh your dashboard for the latest usage data.\n\nThank you for your patience.`,
          variables: ["title", "message"],
        },
        notice: {
          type: "incident",
          severity: "info",
          dismissible: true,
          title: "Incident resolved",
          shortMessage: "Services are healthy again — refresh the dashboard for live usage.",
          message: "Mission Control confirms recovery. If anything still looks wrong, send feedback with your extension version.",
        },
        discord: {
          title: "✅ Incident resolved",
          summary: "Services restored. Ask testers to refresh CCM if usage looked stale.",
        },
      },
    },
    {
      id: "rollback-incident",
      label: "Rollback / incident",
      category: "incident",
      severity: "warning",
      channels: {
        notice: {
          id: "rollback-recovery-notice",
          source: "rollback",
          type: "incident",
          severity: "warning",
          dismissible: false,
          title: "Rollback and recovery notice",
          shortMessage:
            "We're rolling back to the last stable build. Avoid retrying the affected action until we confirm recovery.",
          message:
            "We're extremely sorry for the disruption. An immediate rollback is in progress to restore the last stable version while we investigate. We'll post an update as soon as recovery is confirmed.",
        },
        discord: {
          title: "⏪ Rollback in progress",
          summary: "Deployment rolled back — watch Mission Control for the all-clear.",
        },
      },
    },
    {
      id: "platform-availability",
      label: `Platform availability — v${v}`,
      category: "info",
      severity: "info",
      channels: {
        notice: {
          type: "development",
          severity: "info",
          dismissible: true,
          title: "Available on VS Code, Open VSX, Firefox & GitHub",
          shortMessage: `v${v} is on GitHub Releases; install from your preferred store.`,
          message: `Cursor Curse Monitor v${v} is available from Lorapok Labs on multiple platforms:\n\n• Website: ${ctx.homepage}\n• Open VSX: ${ctx.ovsxUrl}\n• VS Code Marketplace: ${ctx.vscodeUrl}\n• Firefox AMO: ${ctx.firefoxUrl}\n• GitHub Releases: ${ctx.releaseUrl}\n\nSupport: ${ctx.supportEmail}`,
        },
      },
    },
    {
      id: "maintenance-window",
      label: "Maintenance window",
      category: "maintenance",
      severity: "warning",
      channels: {
        notice: {
          type: "maintenance",
          severity: "warning",
          dismissible: true,
          title: "Scheduled maintenance — Mission Control",
          shortMessage: "Brief maintenance on cursor-dev.lorapok.tech — deployments and mailbox may pause.",
          message: `Lorapok Labs will perform scheduled maintenance on Mission Control (${ctx.adminUrl}). Installed extensions continue to work offline with cached data. Follow ${ctx.collaborateUrl} for updates.`,
        },
        discord: {
          title: "🛠️ Maintenance window",
          summary: "Mission Control maintenance — deploy triggers may fail briefly.",
        },
      },
    },
    {
      id: "amo-review-pending",
      label: "Firefox AMO review",
      category: "info",
      severity: "info",
      channels: {
        notice: {
          type: "development",
          severity: "info",
          dismissible: true,
          title: "Firefox AMO review in progress",
          shortMessage: "The browser extension update is awaiting Mozilla review — use GitHub or Chrome meanwhile.",
          message: `Firefox builds may lag Open VSX while AMO review completes. Track status at ${ctx.firefoxUrl} or install from ${ctx.releaseUrl}.`,
        },
      },
    },
    {
      id: "telemetry-opt-in",
      label: "Anonymous stats opt-in",
      category: "info",
      severity: "info",
      channels: {
        notice: {
          type: "info",
          severity: "info",
          dismissible: true,
          title: "Optional anonymous usage heartbeat",
          shortMessage: "Help Lorapok Labs prioritize platforms — enable in dashboard Settings (off by default).",
          message:
            "CCM can send a once-per-day anonymous ping with install ID, OS, and host editor only. No paths, tokens, or workspace names. Toggle **Anonymous usage stats** in dashboard Settings.",
        },
      },
    },
  ];

  return cards.map((card) => ({
    ...card,
    feedbackUrl: ctx.feedbackUrl,
    collaborateUrl: ctx.collaborateUrl,
    updatedAt: now,
  }));
}

/**
 * @param {ReturnType<typeof buildProductContext>} ctx
 */
export function buildMessageCatalog(ctx) {
  return {
    branding: buildMessageBranding(ctx),
    footers: buildChannelFooters(ctx),
    cards: buildMessageCards(ctx),
  };
}

/**
 * @param {ReturnType<typeof buildProductContext>} ctx
 */
export function buildMailTemplatesFromCards(ctx) {
  return buildMessageCards(ctx)
    .filter((card) => card.channels?.email)
    .map((card) => ({
      id: card.id,
      label: card.label,
      category: card.category,
      severity: card.severity,
      subject: card.channels.email.subject,
      text: card.channels.email.text,
      variables: card.channels.email.variables ?? [],
    }));
}

/**
 * @param {ReturnType<typeof buildProductContext>} ctx
 */
export function buildNoticeTemplatesFromCards(ctx) {
  return buildMessageCards(ctx)
    .filter((card) => card.channels?.notice)
    .map((card) => ({
      templateId: card.id,
      label: card.label,
      category: card.category,
      severity: card.channels.notice.severity ?? card.severity ?? "info",
      type: card.channels.notice.type ?? "info",
      dismissible: card.channels.notice.dismissible ?? true,
      title: card.channels.notice.title,
      shortMessage: card.channels.notice.shortMessage,
      message: card.channels.notice.message,
      feedbackUrl: ctx.feedbackUrl,
      collaborateUrl: ctx.collaborateUrl,
      enabled: false,
      source: card.channels.notice.source ?? card.source ?? "template",
      ...(card.channels.notice.id ? { id: card.channels.notice.id } : {}),
      updatedAt: new Date().toISOString(),
    }));
}
