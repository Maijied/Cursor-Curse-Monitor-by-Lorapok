import assert from "node:assert/strict";
import { generateWebhookSecret, DEFAULT_GITHUB_WEBHOOK_EVENTS } from "./github-webhook-bootstrap.mjs";

assert.equal(generateWebhookSecret().length, 64);
assert.deepEqual(DEFAULT_GITHUB_WEBHOOK_EVENTS, ["push", "release", "workflow_run"]);

console.log("github-webhook-bootstrap.test.mjs: OK");
