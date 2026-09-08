import {
  buildComposeHtml,
  buildNoticeHtml,
  buildSubscribeHtml,
  buildTestHtml,
  buildInviteHtml,
} from "./mail.js";
import { getMailTemplates } from "./mail-templates.js";
import { readMailTemplateOverrides, applyMailTemplateOverride } from "./mail-templates-kv.js";
import { interpolateString } from "./template-interpolate.js";
import { buildSubscriberMergeContext, resolveSubscriberMailContext } from "./subscriber-mail-context.js";
import { extractChangelogHeading, formatChangelogNoticeMessage, fetchChangelogMarkdown } from "./changelog-notice.js";

/**
 * @typedef {Object} RenderedMail
 * @property {string} subject
 * @property {string} text
 * @property {string} html
 * @property {string} category
 * @property {string} templateId
 */

/**
 * List catalog templates with optional KV overrides applied.
 * @param {Record<string, unknown>} env
 */
export async function listEffectiveMailTemplates(env) {
  const [templates, { overrides }] = await Promise.all([
    getMailTemplates(env),
    readMailTemplateOverrides(env.ADMIN_KV),
  ]);
  return templates
    .map((row) => applyMailTemplateOverride(row, overrides))
    .filter(Boolean);
}

/**
 * @param {Record<string, unknown>} template
 * @param {Record<string, unknown>} mergeCtx
 */
function buildHtmlForTemplate(template, mergeCtx) {
  const category = String(template.category ?? "compose").toLowerCase();
  const id = String(template.id ?? "");

  if (id === "subscribe-welcome" || category === "subscribe") {
    return buildSubscribeHtml({
      email: String(mergeCtx.email ?? "subscriber@example.com"),
      name: String(mergeCtx.name ?? "there"),
      platform: String(mergeCtx.platform ?? "Website"),
      stats: String(mergeCtx.stats ?? ""),
      unsubscribeHint: String(mergeCtx.unsubscribeHint ?? ""),
    });
  }
  if (id === "mailbox-test" || category === "test") {
    return buildTestHtml({
      email: String(mergeCtx.email ?? "test@example.com"),
      adminUrl: String(mergeCtx.adminUrl ?? "https://cursor-dev.lorapok.tech"),
    });
  }
  if (id === "invite-admin" || category === "invite") {
    return buildInviteHtml({
      inviteUrl: String(mergeCtx.adminUrl ?? mergeCtx.inviteUrl ?? "https://cursor-dev.lorapok.tech"),
      invitedBy: mergeCtx.invitedBy ? String(mergeCtx.invitedBy) : null,
    });
  }
  if (category === "notice" || category === "warning" || category === "incident") {
    return buildNoticeHtml({
      title: String(mergeCtx.title ?? template.label ?? "Notice"),
      message: String(mergeCtx.message ?? mergeCtx.changelogExcerpt ?? template.text ?? ""),
      severity: String(template.severity ?? mergeCtx.severity ?? "info"),
      feedbackUrl: String(mergeCtx.feedbackUrl ?? ""),
    });
  }

  const body = String(mergeCtx.message ?? mergeCtx.text ?? template.text ?? "");
  const subject = String(mergeCtx.subject ?? template.subject ?? "Message from Lorapok Labs");
  return buildComposeHtml({ subject, body });
}

/**
 * Render a catalog template with merge tags and branded HTML.
 * @param {Record<string, unknown>} env
 * @param {string} templateId
 * @param {Record<string, unknown>} mergeCtx
 */
export async function renderMailTemplate(env, templateId, mergeCtx = {}) {
  const templates = await listEffectiveMailTemplates(env);
  const template = templates.find((row) => row.id === templateId);
  if (!template) {
    throw new Error(`Unknown mail template: ${templateId}`);
  }

  const subject = interpolateString(String(template.subject ?? ""), mergeCtx);
  const text = interpolateString(String(template.text ?? ""), mergeCtx);
  const html = buildHtmlForTemplate(
    { ...template, text },
    { ...mergeCtx, message: text, subject }
  );

  return {
    subject,
    text,
    html,
    category: String(template.category ?? "compose"),
    templateId: String(template.id),
  };
}

/**
 * Sample merge context for Settings gallery previews.
 * @param {Record<string, unknown>} env
 */
export async function buildSampleMergeContext(env) {
  const { productCtx, siteData } = await resolveSubscriberMailContext(env);
  const sampleSubscriber = {
    email: "preview@lorapok.tech",
    subscribedAt: new Date().toISOString(),
    source: "website",
    installId: null,
    consentVersion: "2026-08-25",
  };
  const mergeCtx = buildSubscriberMergeContext(sampleSubscriber, productCtx, siteData, env);
  mergeCtx.changelogExcerpt =
    "• Branded mail templates aligned with messageCatalog\n• Dynamic subscriber merge tags (name, platform, stats)\n• Settings gallery preview for operators";
  mergeCtx.title = "Preview notice";
  mergeCtx.message = mergeCtx.changelogExcerpt;
  return mergeCtx;
}

/**
 * Welcome email for a new subscriber (MAIL-14).
 * @param {Record<string, unknown>} env
 * @param {import("./subscribers.js").SubscriberRecord} subscriber
 */
export async function renderSubscriberWelcomeMail(env, subscriber) {
  const { productCtx, siteData } = await resolveSubscriberMailContext(env);
  const mergeCtx = buildSubscriberMergeContext(subscriber, productCtx, siteData, env);
  return renderMailTemplate(env, "subscribe-welcome", mergeCtx);
}

/**
 * Release digest email for one subscriber (MAIL-14).
 * @param {Record<string, unknown>} env
 * @param {import("./subscribers.js").SubscriberRecord} subscriber
 * @param {{ tag?: string }} [options]
 */
export async function renderSubscriberDigestMail(env, subscriber, options = {}) {
  const { productCtx, siteData } = await resolveSubscriberMailContext(env);
  const mergeCtx = buildSubscriberMergeContext(subscriber, productCtx, siteData, env);
  const tag = String(options.tag ?? productCtx.releaseTag ?? `v${productCtx.releaseVersion ?? "1.0.0"}`);

  let changelogExcerpt = String(productCtx.releaseHighlights ?? "").trim();
  if (!changelogExcerpt) {
    try {
      const markdown = await fetchChangelogMarkdown(env);
      const section = extractChangelogHeading(markdown, tag.replace(/^v/i, ""));
      if (section) {
        changelogExcerpt = formatChangelogNoticeMessage(section, tag, {
          productName: String(productCtx.displayName ?? "Cursor Curse Monitor"),
          releaseUrl: String(productCtx.releaseUrl ?? ""),
          homepage: String(productCtx.homepage ?? ""),
        });
      }
    } catch {
      changelogExcerpt = `Check the latest release at ${productCtx.releaseUrl ?? productCtx.homepage}.`;
    }
  }

  mergeCtx.changelogExcerpt = changelogExcerpt;
  mergeCtx.message = changelogExcerpt;

  try {
    return await renderMailTemplate(env, "subscriber-digest", mergeCtx);
  } catch {
    return renderMailTemplate(env, "release-notes", mergeCtx);
  }
}
