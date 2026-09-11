import assert from "node:assert/strict";
import {
  computeSecretDrift,
  normalizeCredSyncState,
  REQUIRED_CI_SECRET_NAMES,
} from "./cred-sync-audit.js";

assert.deepEqual(computeSecretDrift(["A", "B"], ["A", "B", "C"]), {
  missing: [],
  ok: true,
});

assert.deepEqual(computeSecretDrift(["A", "B"], ["A"]), {
  missing: ["B"],
  ok: false,
});

const normalized = normalizeCredSyncState({
  lastSuccessAt: "2026-09-11T00:00:00.000Z",
  recentAttempts: [{ ts: "2026-09-11T00:00:00.000Z", ok: true, integration: "cloudflare" }],
});
assert.equal(normalized.lastSuccessAt, "2026-09-11T00:00:00.000Z");
assert.equal(normalized.recentAttempts.length, 1);

const trimmed = normalizeCredSyncState({
  recentAttempts: Array.from({ length: 25 }, (_, i) => ({ ts: String(i), ok: true })),
});
assert.equal(trimmed.recentAttempts.length, 20);

assert.ok(REQUIRED_CI_SECRET_NAMES.includes("CRED_STORE_GPG_BASE64"));
assert.ok(REQUIRED_CI_SECRET_NAMES.includes("CRED_VAULT_PASSPHRASE"));

console.log("cred-sync-audit.test.mjs: ok");
