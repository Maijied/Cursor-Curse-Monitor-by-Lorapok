import assert from "node:assert/strict";
import {
  DEFAULT_GITHUB_WEBHOOK_EVENTS,
  generateWebhookSecret,
  normalizeWebhookEvents,
  summarizeGithubWebhookPayload,
  verifyGithubWebhookSignature,
} from "./github-webhook.js";

assert.equal(generateWebhookSecret().length, 64);
assert.deepEqual(normalizeWebhookEvents(["push", "bogus"]), ["push"]);
assert.deepEqual(normalizeWebhookEvents([]), [...DEFAULT_GITHUB_WEBHOOK_EVENTS]);

const secret = "test-secret";
const body = JSON.stringify({ ref: "refs/heads/main" });
const enc = new TextEncoder();
const key = await crypto.subtle.importKey(
  "raw",
  enc.encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"]
);
const digest = await crypto.subtle.sign("HMAC", key, enc.encode(body));
const signature =
  "sha256=" +
  Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");

assert.equal(await verifyGithubWebhookSignature(secret, body, signature), true);
assert.equal(await verifyGithubWebhookSignature(secret, body, "sha256=deadbeef"), false);

assert.match(
  summarizeGithubWebhookPayload({ release: { tag_name: "v1.2.3" }, action: "published" }),
  /v1\.2\.3/
);
assert.match(
  summarizeGithubWebhookPayload({ workflow_run: { name: "CI", conclusion: "success" } }),
  /CI/
);

console.log("github-webhook.test.mjs: OK");
