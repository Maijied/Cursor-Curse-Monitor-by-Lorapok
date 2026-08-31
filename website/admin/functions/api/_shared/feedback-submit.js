import { logSystemEvent } from "./system-log.js";
import { notifyDiscordFeedback } from "./discord-feedback-notify.js";
import { normalizeEmail } from "./subscribers.js";
import { putScatterRecord } from "./kv-scatter.js";

/** @deprecated Legacy blob key — scatter keys used since 2026-09. */
export const FEEDBACK_SUBMISSIONS_KEY = "feedback:submissions";
export const FEEDBACK_ITEM_PREFIX = "feedback:item";
const MESSAGE_MAX = 4000;

const KINDS = new Set(["bug", "feature", "general"]);

/** @param {unknown} value */
export function normalizeFeedbackKind(value) {
  const kind = String(value ?? "general").trim().toLowerCase();
  return KINDS.has(kind) ? kind : "general";
}

/** @param {unknown} value */
function normalizeMessage(value) {
  const message = String(value ?? "").trim();
  if (!message) return null;
  return message.slice(0, MESSAGE_MAX);
}

/** @param {unknown} value */
function normalizeInstallId(value) {
  const id = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id.toLowerCase()
    : null;
}

/**
 * @param {Record<string, unknown>} env
 * @param {{
 *   kind?: string;
 *   message: string;
 *   source?: string;
 *   version?: string;
 *   editor?: string;
 *   installId?: string | null;
 *   email?: string | null;
 * }} input
 */
export async function submitProductFeedback(env, input) {
  const message = normalizeMessage(input.message);
  if (!message) {
    return { ok: false, error: "Message is required", status: 400 };
  }

  const kind = normalizeFeedbackKind(input.kind);
  const source = String(input.source ?? "unknown").trim().slice(0, 80) || "unknown";
  const version = String(input.version ?? "").trim().slice(0, 40) || null;
  const editor = String(input.editor ?? "").trim().slice(0, 120) || null;
  const installId = normalizeInstallId(input.installId);
  const email = input.email ? normalizeEmail(input.email) : null;

  const record = {
    id: crypto.randomUUID(),
    kind,
    message,
    source,
    version,
    editor,
    installId,
    email,
    createdAt: new Date().toISOString(),
  };

  const kindLabel = kind === "bug" ? "Bug report" : kind === "feature" ? "Feature request" : "Feedback";
  const summaryLines = [
    `**${kindLabel}** from \`${source}\``,
    "",
    message,
    "",
    "---",
    version ? `Version: ${version}` : "",
    editor ? `Editor: ${editor}` : "",
    installId ? `Install: \`${installId}\`` : "",
    email ? `Contact: ${email}` : "",
  ].filter(Boolean);

  const discord = await notifyDiscordFeedback(env, {
    summary: summaryLines.join("\n"),
    triggeredBy: email,
    kind,
    source,
    version,
    editor,
    installId,
    message,
  });

  const kv = env.ADMIN_KV;
  let stored = false;
  if (kv?.put) {
    stored = await putScatterRecord(kv, FEEDBACK_ITEM_PREFIX, record.id, record, {
      ts: Date.parse(record.createdAt),
    });
  }

  await logSystemEvent(env, {
    source: "feedback",
    level: discord.ok || discord.skipped ? "info" : "warn",
    message: discord.ok
      ? `User feedback received (${kind}, ${source})`
      : discord.skipped
        ? `User feedback stored; Discord hook not configured (${kind})`
        : `User feedback stored; Discord notify failed (${discord.error ?? "unknown"})`,
    meta: { kind, source, feedbackId: record.id, discordOk: discord.ok, discordSkipped: discord.skipped },
    email,
  });

  if (!discord.ok && !discord.skipped) {
    return {
      ok: true,
      stored,
      discordDelivered: false,
      warning: "Feedback saved but Discord notification failed. Configure feedback webhook in Mission Control → Settings.",
      id: record.id,
    };
  }

  return {
    ok: true,
    stored,
    discordDelivered: discord.ok,
    id: record.id,
    message: "Thanks — your feedback was sent to the community team.",
  };
}
