import embedded from "./product-context.embedded.json" with { type: "json" };
import {
  buildBuiltinNotices,
  buildGeneratedCatalogNotice,
  buildNoticeTemplates,
} from "../../../../../scripts/notice-templates.mjs";

const ctx = embedded.ctx;
const builtins = buildBuiltinNotices({
  version: embedded.version,
  displayName: embedded.displayName,
  homepage: ctx.homepage,
  company: {
    adminUrl: ctx.adminUrl,
    supportEmail: ctx.supportEmail,
    productEmail: ctx.productEmail,
    website: ctx.website,
  },
  repository: { url: `https://github.com/${ctx.repo}` },
});

export const GENERATED_DEV_NOTICE = buildGeneratedCatalogNotice(ctx);

export const CONVERSATION_RECOVERY_NOTICE =
  builtins.find((n) => n.id === "conversation-recovery-v0515") ?? builtins[1];

export const ROLLBACK_NOTICE =
  builtins.find((n) => n.id === "rollback-recovery-notice") ?? {
    id: "rollback-recovery-notice",
    source: "rollback",
    enabled: false,
    type: "incident",
    severity: "warning",
    title: "Rollback and Recovery Notice",
    shortMessage:
      "We're extremely sorry — an immediate rollback is in progress to restore stability.",
    message:
      "We're extremely sorry for the disruption. We have initiated an immediate rollback to restore the last stable version while we investigate the issue.",
    feedbackUrl: ctx.feedbackUrl,
    collaborateUrl: ctx.collaborateUrl,
    dismissible: false,
    updatedAt: null,
  };

export const BUILTIN_NOTICES = builtins;

export { buildBuiltinNotices };

export function getNoticeTemplates() {
  return buildNoticeTemplates(ctx);
}

export { ctx as productContext };
