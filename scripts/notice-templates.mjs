import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProductContext } from "./lib-product-context.mjs";

const templatesRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRootPkg() {
  return JSON.parse(readFileSync(join(templatesRoot, "package.json"), "utf8"));
}

/**
 * @param {ReturnType<typeof buildProductContext>} ctx
 */
export function buildNoticeTemplates(ctx) {
  const v = ctx.version;
  return [
    {
      templateId: "feature-release",
      label: `New features — v${v}`,
      category: "feature",
      severity: "info",
      type: "feature",
      dismissible: true,
      title: `What's new in Cursor Curse Monitor v${v}`,
      shortMessage: `v${v} adds animated stats on the website, Firefox AMO listing fixes, Mission Control deploy validation, and a What's New popup in the browser extension.`,
      message: `Cursor Curse Monitor v${v} is rolling out across Open VSX, VS Code Marketplace, Firefox AMO, and GitHub Releases.

Highlights:
• Animated live stats hero on ${ctx.homepage}
• Browser extension What's New card on version bump
• Firefox MV3 manifest compatibility (AMO warnings resolved)
• Mission Control deploy instructions and validation
• Mailbox mail relay for reliable outbound email

Update via your preferred marketplace or download the latest release: ${ctx.releaseUrl}`,
    },
    {
      templateId: "bugfix-patch",
      label: `Bug fix release — v${v}`,
      category: "bugfix",
      severity: "info",
      type: "maintenance",
      dismissible: true,
      title: `Bug fixes in v${v}`,
      shortMessage: `Patch v${v} addresses reported issues. Update when convenient — your settings stay on device.`,
      message: `We've shipped v${v} with bug fixes and stability improvements for Cursor Curse Monitor.

If you hit an issue on an older build, update to v${v} from Open VSX, VS Code Marketplace, Firefox AMO, or GitHub Releases: ${ctx.releaseUrl}

Still stuck? Report details at ${ctx.feedbackUrl} — include your extension version and Cursor version.`,
    },
    {
      templateId: "security-advisory",
      label: "Security advisory",
      category: "security",
      severity: "warning",
      type: "security",
      dismissible: false,
      title: "Security update recommended",
      shortMessage: "Please update to the latest release — includes security hardening for token handling and local storage.",
      message: `A security-related improvement is included in the latest Cursor Curse Monitor release.

Action recommended:
1. Update to v${v} or newer from your marketplace or ${ctx.releaseUrl}
2. Re-paste your Cursor token only via cursor.com/dashboard or Options — never share tokens in chat or email
3. Review the local security scanner warnings in the extension popup

Questions? Contact ${ctx.supportEmail} or open ${ctx.feedbackUrl}`,
    },
    {
      templateId: "maintenance-window",
      label: "Maintenance window",
      category: "maintenance",
      severity: "warning",
      type: "maintenance",
      dismissible: true,
      title: "Scheduled maintenance — Mission Control",
      shortMessage: "Brief maintenance on cursor-dev.lorapok.tech — deployments and mailbox may be unavailable for a short window.",
      message: `Lorapok Labs will perform scheduled maintenance on Mission Control (${ctx.adminUrl}).

During this window, admin deploy triggers and mailbox tests may fail temporarily. The marketing site (${ctx.homepage}) and installed extensions continue to work offline with cached data.

We'll post an all-clear notice when maintenance completes. Follow ${ctx.collaborateUrl} for updates.`,
    },
    {
      templateId: "conversation-recovery",
      label: "Conversation recovery (v0.5.15+)",
      category: "feature",
      severity: "info",
      type: "feature",
      dismissible: true,
      id: "conversation-recovery-v0515",
      source: "release",
      title: "Recover Missing Agent Conversations",
      shortMessage:
        "Get back chats lost after a worktree switch — v0.5.15+ rebuilds your conversation list safely from saved transcripts.",
      message:
        "If your IDE sidebar lost chats after a worktree switch, branch change, or workspace path mismatch, update to Cursor Curse Monitor v0.5.15 or newer and run Reindex Missing Conversations from the dashboard. The tool rebuilds search and sidebar indexes from on-disk agent transcripts without deleting your existing data.",
    },
    {
      templateId: "rollback-incident",
      label: "Rollback / incident",
      category: "incident",
      severity: "warning",
      type: "incident",
      dismissible: false,
      id: "rollback-recovery-notice",
      source: "rollback",
      title: "Rollback and Recovery Notice",
      shortMessage:
        "We're extremely sorry — an immediate rollback is in progress to restore stability. We'll update you as soon as recovery is confirmed.",
      message:
        "We're extremely sorry for the disruption. We have initiated an immediate rollback to restore the last stable version while we investigate the issue. Please avoid retrying the affected action for now. We'll post an update as soon as recovery is confirmed.",
    },
    {
      templateId: "platform-availability",
      label: `Platform availability — v${v}`,
      category: "info",
      severity: "info",
      type: "development",
      dismissible: true,
      title: "Available on VS Code, Open VSX, Firefox & GitHub",
      shortMessage: `v${v} is on GitHub Releases; Firefox AMO review pending; install from your preferred store.`,
      message: `Cursor Curse Monitor v${v} is available from Lorapok Labs on multiple platforms:

• Website: ${ctx.homepage}
• Open VSX: ${ctx.ovsxUrl}
• VS Code Marketplace: ${ctx.vscodeUrl}
• Firefox AMO: ${ctx.firefoxUrl}
• GitHub Releases: ${ctx.releaseUrl}

Support: ${ctx.supportEmail}`,
    },
  ].map((t) => ({
    ...t,
    feedbackUrl: ctx.feedbackUrl,
    collaborateUrl: ctx.collaborateUrl,
    enabled: false,
    source: t.source ?? "template",
    updatedAt: new Date().toISOString(),
  }));
}

/** Default generated catalog notice — synced into KV; disabled until admin enables. */
export function buildGeneratedCatalogNotice(ctx) {
  return {
    id: "generated-dev-notice",
    source: "generated",
    enabled: false,
    type: "development",
    severity: "info",
    title: `${ctx.displayName} v${ctx.version}`,
    shortMessage: `v${ctx.version} is live on GitHub Releases with website polish, Firefox AMO fixes, and Mission Control improvements.`,
    message: `${ctx.displayName} v${ctx.version} is the current release from Lorapok Labs.

This build includes animated website stats, cross-platform install links, Firefox manifest compatibility, admin deploy validation, and mailbox reliability fixes.

Install or update: ${ctx.releaseUrl}
Get help: ${ctx.supportEmail}`,
    feedbackUrl: ctx.feedbackUrl,
    collaborateUrl: ctx.collaborateUrl,
    dismissible: true,
    updatedAt: new Date().toISOString(),
  };
}

/** @param {Record<string, unknown>} [pkg] */
export function buildBuiltinNotices(pkg = readRootPkg()) {
  const ctx = buildProductContext(pkg);
  const templates = buildNoticeTemplates(ctx);
  const recovery = templates.find((t) => t.templateId === "conversation-recovery");
  const rollback = templates.find((t) => t.templateId === "rollback-incident");
  return [
    buildGeneratedCatalogNotice(ctx),
    {
      id: recovery.id,
      source: recovery.source,
      enabled: false,
      type: recovery.type,
      severity: recovery.severity,
      title: recovery.title,
      message: recovery.message,
      shortMessage: recovery.shortMessage,
      feedbackUrl: recovery.feedbackUrl,
      collaborateUrl: recovery.collaborateUrl,
      dismissible: recovery.dismissible,
      updatedAt: recovery.updatedAt,
    },
    {
      id: rollback.id,
      source: rollback.source,
      enabled: false,
      type: rollback.type,
      severity: rollback.severity,
      title: rollback.title,
      message: rollback.message,
      shortMessage: rollback.shortMessage,
      feedbackUrl: rollback.feedbackUrl,
      collaborateUrl: rollback.collaborateUrl,
      dismissible: rollback.dismissible,
      updatedAt: rollback.updatedAt,
    },
  ];
}
