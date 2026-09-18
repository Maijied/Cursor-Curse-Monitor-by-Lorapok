import assert from "node:assert/strict";
import {
  applyConsentChoice,
  emptyConsentAudit,
  normalizeConsentAudit,
  normalizeConsentChoice,
  PROCESS_CONSENT_VERSION,
} from "./consent-audit.js";

assert.equal(PROCESS_CONSENT_VERSION, "2026-09-18");
assert.equal(normalizeConsentChoice("Allow"), "analytics_accept");
assert.equal(normalizeConsentChoice("reject"), "analytics_decline");

let audit = applyConsentChoice(emptyConsentAudit(), "analytics_decline", "2026-09-18");
audit = applyConsentChoice(audit, "analytics_accept", "2026-09-18");
assert.equal(audit.totals.analytics_decline, 1);
assert.equal(audit.totals.analytics_accept, 1);
assert.deepEqual(normalizeConsentAudit(null).totals, { analytics_accept: 0, analytics_decline: 0 });

console.log("consent-audit.test.mjs: OK");
