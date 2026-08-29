import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProductContext } from "./lib-product-context.mjs";
import { buildNoticeTemplatesFromCards } from "./message-cards.mjs";

const templatesRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRootPkg() {
  return JSON.parse(readFileSync(join(templatesRoot, "package.json"), "utf8"));
}

/**
 * @param {ReturnType<typeof buildProductContext>} ctx
 */
export function buildNoticeTemplates(ctx) {
  return buildNoticeTemplatesFromCards(ctx);
}

/** Default generated catalog notice — synced into KV; disabled until admin enables. */
export function buildGeneratedCatalogNotice(ctx) {
  const templates = buildNoticeTemplates(ctx);
  const feature = templates.find((t) => t.templateId === "feature-release");
  if (feature) {
    return {
      id: "generated-dev-notice",
      source: "generated",
      enabled: false,
      type: feature.type,
      severity: feature.severity,
      title: feature.title,
      shortMessage: feature.shortMessage,
      message: feature.message,
      feedbackUrl: feature.feedbackUrl,
      collaborateUrl: feature.collaborateUrl,
      dismissible: feature.dismissible,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    id: "generated-dev-notice",
    source: "generated",
    enabled: false,
    type: "development",
    severity: "info",
    title: `${ctx.displayName} v${ctx.version}`,
    shortMessage: `v${ctx.version} is live on GitHub Releases with website polish and Mission Control improvements.`,
    message: `${ctx.displayName} v${ctx.version} is the current release from Lorapok Labs.\n\nInstall or update: ${ctx.releaseUrl}\nGet help: ${ctx.supportEmail}`,
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
  const generated = buildGeneratedCatalogNotice(ctx);

  /** @param {typeof templates[number]|undefined} template */
  function toNotice(template, fallbackId) {
    if (!template) {
      return null;
    }
    return {
      id: template.id ?? fallbackId,
      source: template.source,
      enabled: false,
      type: template.type,
      severity: template.severity,
      title: template.title,
      message: template.message,
      shortMessage: template.shortMessage,
      feedbackUrl: template.feedbackUrl,
      collaborateUrl: template.collaborateUrl,
      dismissible: template.dismissible,
      updatedAt: template.updatedAt,
    };
  }

  return [
    generated,
    toNotice(recovery, "conversation-recovery-v0515"),
    toNotice(rollback, "rollback-recovery-notice"),
  ].filter(Boolean);
}
