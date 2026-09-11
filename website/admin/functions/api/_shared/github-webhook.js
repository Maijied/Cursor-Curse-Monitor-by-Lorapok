import { putKvJsonIfChanged } from "./kv-put.js";
import { logSystemEvent } from "./system-log.js";
import { readGithubIntegrationConfig } from "./github-integration-config.js";

export const GITHUB_WEBHOOK_EVENTS_KEY = "integrations:github-webhook-events";

export const DEFAULT_GITHUB_WEBHOOK_EVENTS = ["push", "release", "workflow_run"];

const MAX_RECENT_EVENTS = 25;

/**
 * @param {number} [bytes]
 */
export function generateWebhookSecret(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * @param {string} secret
 * @param {string} body
 * @param {string} signature
 */
export async function verifyGithubWebhookSignature(secret, body, signature) {
  const sig = String(signature ?? "").trim();
  if (!secret || !sig.startsWith("sha256=")) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected =
    "sha256=" +
    Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");

  if (expected.length !== sig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * @param {unknown} parsed
 */
export function normalizeWebhookEvents(parsed) {
  const raw = Array.isArray(parsed) ? parsed : DEFAULT_GITHUB_WEBHOOK_EVENTS;
  const allowed = new Set(DEFAULT_GITHUB_WEBHOOK_EVENTS);
  const events = raw.map((e) => String(e).trim()).filter((e) => allowed.has(e));
  return events.length ? events : [...DEFAULT_GITHUB_WEBHOOK_EVENTS];
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readRecentGithubWebhookEvents(env) {
  if (!env?.ADMIN_KV?.get) return [];
  try {
    const raw = await env.ADMIN_KV.get(GITHUB_WEBHOOK_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.events) ? parsed.events.slice(0, MAX_RECENT_EVENTS) : [];
  } catch {
    return [];
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} entry
 */
async function appendGithubWebhookEvent(env, entry) {
  if (!env?.ADMIN_KV?.get || !env?.ADMIN_KV?.put) return;
  const existing = await readRecentGithubWebhookEvents(env);
  const events = [
    {
      ts: new Date().toISOString(),
      ...entry,
    },
    ...existing,
  ].slice(0, MAX_RECENT_EVENTS);
  await putKvJsonIfChanged(env.ADMIN_KV, GITHUB_WEBHOOK_EVENTS_KEY, { events });
}

/**
 * @param {Record<string, unknown>} payload
 */
export function summarizeGithubWebhookPayload(payload) {
  const action = payload?.action ? String(payload.action) : null;
  if (payload?.release?.tag_name) {
    return `release ${payload.release.tag_name}${action ? ` (${action})` : ""}`;
  }
  if (payload?.workflow_run?.name) {
    const status = payload.workflow_run.conclusion ?? payload.workflow_run.status ?? "unknown";
    return `workflow ${payload.workflow_run.name} — ${status}`;
  }
  if (payload?.ref) {
    return `push ${String(payload.ref).replace(/^refs\/heads\//, "")}`;
  }
  return "event received";
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ event: string; deliveryId?: string | null; payload: Record<string, unknown> }} input
 */
export async function ingestGithubWebhook(env, input) {
  const config = await readGithubIntegrationConfig(env);
  const enabledEvents = normalizeWebhookEvents(config.webhookEvents);
  const event = String(input.event ?? "").trim();

  if (!enabledEvents.includes(event)) {
    return { ok: true, skipped: true, reason: "event_disabled" };
  }

  const summary = summarizeGithubWebhookPayload(input.payload);
  await appendGithubWebhookEvent(env, {
    event,
    deliveryId: input.deliveryId ?? null,
    summary,
    repository: input.payload?.repository?.full_name ?? config.repository,
  });

  await logSystemEvent(env, {
    level: "info",
    source: "github-webhook",
    message: `GitHub ${event}: ${summary}`,
    meta: {
      event,
      deliveryId: input.deliveryId ?? null,
      repository: input.payload?.repository?.full_name ?? config.repository,
    },
  });

  return { ok: true, event, summary };
}
