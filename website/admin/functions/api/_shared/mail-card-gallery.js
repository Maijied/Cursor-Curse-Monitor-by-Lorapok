import {
  buildSampleMergeContext,
  listEffectiveMailTemplates,
  renderMailTemplate,
} from "./mail-template-engine.js";
import { getMailTransportStatus } from "./mail.js";

/** @typedef {Object} MailGalleryItem
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} category
 */

export const MAIL_GALLERY_ITEMS = [
  {
    id: "subscribe-welcome",
    label: "Subscribe welcome",
    description: "Dynamic merge tags: name, platform, stats, unsubscribe hint.",
    category: "subscribe",
  },
  {
    id: "subscriber-digest",
    label: "Release digest",
    description: "Changelog excerpt + stats from site-data for opt-in subscribers.",
    category: "subscribe",
  },
  {
    id: "release-notes",
    label: "Release notes",
    description: "Broadcast-style release announcement aligned with messageCatalog.",
    category: "notice",
  },
  {
    id: "warning-incident",
    label: "Warning incident",
    description: "Service notice with severity badge and feedback CTA.",
    category: "notice",
  },
  {
    id: "mailbox-test",
    label: "Mailbox test",
    description: "Live delivery confirmation from Mission Control transport.",
    category: "test",
  },
];

/**
 * @param {Record<string, unknown>} env
 * @param {string} templateId
 */
export async function buildMailGalleryPreview(env, templateId) {
  const item = MAIL_GALLERY_ITEMS.find((entry) => entry.id === templateId);
  if (!item) return null;

  const mergeCtx = await buildSampleMergeContext(env);
  if (item.id === "warning-incident") {
    mergeCtx.title = "Service notice — action may be required";
    mergeCtx.message =
      "We're investigating an issue affecting some users. Refresh the dashboard after we confirm recovery.";
    mergeCtx.severity = "warning";
  }

  try {
    const rendered = await renderMailTemplate(env, templateId, mergeCtx);
    return {
      item,
      preview: {
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        category: rendered.category,
      },
    };
  } catch {
    return null;
  }
}

/** @param {Record<string, unknown>} env */
export async function listMailGalleryPreviews(env) {
  const effective = await listEffectiveMailTemplates(env);
  const ids = new Set(effective.map((row) => row.id));
  const items = MAIL_GALLERY_ITEMS.filter((entry) => ids.has(entry.id));
  const previews = [];
  for (const entry of items) {
    const built = await buildMailGalleryPreview(env, entry.id);
    if (built) previews.push(built);
  }
  return previews;
}

/** @param {Record<string, unknown>} env */
export async function getMailGalleryMeta(env) {
  const transport = getMailTransportStatus(env);
  const templates = await listEffectiveMailTemplates(env);
  return {
    transport,
    templateCount: templates.length,
  };
}
