import { extractChangelogSection, normalizeTag, truncateDiscordText } from "./discord-deploy-context.js";
import { putKvJsonIfChanged } from "./kv-put.js";
import { githubFetch } from "./github.js";
import { GITHUB_REPO } from "./auth.js";

const INDEX_KEY = "social-gallery:index";
const ITEM_PREFIX = "social-gallery:item:";
const MAX_INDEX_ITEMS = 48;

/**
 * @param {string | null | undefined} actionType
 * @returns {boolean}
 */
export function shouldQueueSocialGallery(actionType) {
  const action = String(actionType ?? "").toLowerCase();
  if (!action || action.includes("deploy-infra") || action.includes("seo-refresh")) return false;
  return (
    action.includes("publish-tag") ||
    action.includes("full-release") ||
    action.includes("rollback") ||
    action.includes("sync-open-vsx")
  );
}

/**
 * @param {string | null | undefined} tag
 * @param {string | null | undefined} changelog
 * @returns {string}
 */
export function buildSocialGalleryCaption(tag, changelog) {
  const version = normalizeTag(tag).replace(/^v/i, "");
  const header = `Cursor Curse Monitor ${version}`;
  if (!changelog?.trim()) return header;

  const bullets = changelog
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]/.test(line))
    .slice(0, 5)
    .join("\n");
  const body = bullets || changelog.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3).join("\n");
  return truncateDiscordText(`${header}\n\n${body}`, 500);
}

/**
 * @param {Record<string, unknown>} env
 */
async function readIndex(env) {
  if (!env.ADMIN_KV?.get) return { items: [], updatedAt: null };
  try {
    const raw = await env.ADMIN_KV.get(INDEX_KEY);
    if (!raw) return { items: [], updatedAt: null };
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return { items: [], updatedAt: null };
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ items: Array<Record<string, unknown>> }} index
 */
async function writeIndex(env, index) {
  if (!env.ADMIN_KV?.put) throw new Error("ADMIN_KV binding not configured");
  const payload = {
    items: index.items.slice(0, MAX_INDEX_ITEMS),
    updatedAt: new Date().toISOString(),
  };
  await putKvJsonIfChanged(env, INDEX_KEY, payload);
  return payload;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} tag
 */
async function fetchChangelogForTag(env, tag) {
  const releaseTag = normalizeTag(tag);
  if (!releaseTag) return null;

  const releaseRes = await githubFetch(
    `/repos/${GITHUB_REPO}/releases/tags/${encodeURIComponent(releaseTag)}`,
    env,
  );
  if (releaseRes.ok) {
    const release = await releaseRes.json();
    if (release?.body?.trim()) return release.body.trim();
  }

  const rawRes = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/main/CHANGELOG.md`, {
    headers: { Accept: "text/plain" },
  });
  if (!rawRes.ok) return null;
  const markdown = await rawRes.text();
  return extractChangelogSection(markdown, releaseTag);
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} id
 */
async function readItem(env, id) {
  if (!env.ADMIN_KV?.get) return null;
  const raw = await env.ADMIN_KV.get(`${ITEM_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {number} [limit]
 */
export async function listSocialGalleryQueue(env, limit = 20) {
  const index = await readIndex(env);
  const slice = index.items.slice(0, Math.max(1, Math.min(limit, MAX_INDEX_ITEMS)));
  const items = [];
  for (const entry of slice) {
    const item = await readItem(env, String(entry.id));
    if (item) items.push(item);
  }
  return { items, updatedAt: index.updatedAt };
}

/**
 * Queue a SOCIAL-02 gallery generation job after a successful deploy.
 *
 * @param {Record<string, unknown>} env
 * @param {{
 *   tag?: string | null;
 *   actionType?: string | null;
 *   caption?: string | null;
 *   runUrl?: string | null;
 *   triggeredBy?: string | null;
 *   source?: string | null;
 *   channel?: string | null;
 *   market?: string | null;
 * }} payload
 */
export async function queueSocialGalleryJob(env, payload) {
  if (!shouldQueueSocialGallery(payload.actionType)) {
    return { ok: true, skipped: true, reason: "action_not_eligible" };
  }

  const tag = normalizeTag(payload.tag);
  if (!tag) {
    return { ok: true, skipped: true, reason: "missing_tag" };
  }

  if (!env.ADMIN_KV?.put) {
    return { ok: false, error: "ADMIN_KV binding not configured" };
  }

  const index = await readIndex(env);
  const existing = index.items.find(
    (entry) => entry.tag === tag && (entry.status === "pending" || entry.status === "generating"),
  );
  if (existing) {
    const item = await readItem(env, String(existing.id));
    return { ok: true, skipped: true, reason: "already_queued", item };
  }

  let changelog = payload.caption?.trim() || null;
  if (!changelog) {
    try {
      changelog = await fetchChangelogForTag(env, tag);
    } catch (error) {
      console.warn("social-gallery: changelog lookup failed", error);
    }
  }

  const id = `${Date.now()}-${tag.replace(/[^a-z0-9.-]/gi, "")}`;
  const item = {
    id,
    tag,
    status: "pending",
    actionType: payload.actionType ?? null,
    channel: payload.channel ?? null,
    market: payload.market ?? null,
    caption: buildSocialGalleryCaption(tag, changelog),
    changelogExcerpt: changelog ? truncateDiscordText(changelog, 1200) : null,
    runUrl: payload.runUrl ?? null,
    triggeredBy: payload.triggeredBy ?? null,
    source: payload.source ?? "mission-control",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    imageUrl: null,
    error: null,
  };

  await env.ADMIN_KV.put(`${ITEM_PREFIX}${id}`, JSON.stringify(item));
  index.items.unshift({
    id,
    tag,
    status: item.status,
    createdAt: item.createdAt,
  });
  await writeIndex(env, index);

  return { ok: true, item };
}
