import { jsonResponse } from "../_shared/auth.js";
import {
  ingestGithubWebhook,
  verifyGithubWebhookSignature,
} from "../_shared/github-webhook.js";
import { readGithubIntegrationConfig } from "../_shared/github-integration-config.js";

/**
 * Public GitHub webhook ingest — HMAC verified via X-Hub-Signature-256.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const config = await readGithubIntegrationConfig(env);
  const secret = String(config.webhookSecret ?? "").trim();

  if (!secret) {
    return jsonResponse({ error: "GitHub webhook secret not configured" }, 503);
  }

  const signature = request.headers.get("X-Hub-Signature-256") ?? "";
  const deliveryId = request.headers.get("X-GitHub-Delivery");
  const event = request.headers.get("X-GitHub-Event") ?? "unknown";
  const body = await request.text();

  const valid = await verifyGithubWebhookSignature(secret, body, signature);
  if (!valid) {
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const result = await ingestGithubWebhook(env, { event, deliveryId, payload });
  return jsonResponse({ ok: true, ...result });
}

export async function onRequestGet() {
  return jsonResponse({ error: "Use POST from GitHub webhooks" }, 405);
}
