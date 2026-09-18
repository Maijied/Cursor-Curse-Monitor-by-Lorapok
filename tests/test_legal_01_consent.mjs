/**
 * LEGAL-01 — process consent audit + marketing gate contract.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyConsentChoice,
  emptyConsentAudit,
  normalizeConsentChoice,
  PROCESS_CONSENT_VERSION,
} from "../website/admin/functions/api/_shared/consent-audit.js";
import { CONSENT_VERSION } from "../website/admin/functions/api/_shared/subscribers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

assert.equal(PROCESS_CONSENT_VERSION, "2026-09-18");
assert.equal(CONSENT_VERSION, "2026-09-18");
assert.equal(normalizeConsentChoice("accept"), "analytics_accept");
assert.equal(normalizeConsentChoice("analytics_decline"), "analytics_decline");
assert.equal(normalizeConsentChoice("nope"), null);

const audit = applyConsentChoice(emptyConsentAudit(), "analytics_accept", "2026-09-18");
assert.equal(audit.totals.analytics_accept, 1);
assert.equal(audit.byDay["2026-09-18"].analytics_accept, 1);

for (const rel of [
  "website/consent.js",
  "website/consent.css",
  "website/admin/functions/api/consent.ts",
  "website/admin/functions/api/_shared/consent-audit.js",
]) {
  assert.ok(existsSync(join(root, rel)), `missing ${rel}`);
}

const analytics = readFileSync(join(root, "website/analytics.js"), "utf8");
assert.match(analytics, /ccm:consent-analytics/);
assert.match(analytics, /fail closed|LEGAL-01/i);

const consentJs = readFileSync(join(root, "website/consent.js"), "utf8");
assert.match(consentJs, /ccm-process-consent/);
assert.match(consentJs, /2026-09-18/);

const index = readFileSync(join(root, "website/index.html"), "utf8");
assert.match(index, /consent\.js/);
assert.match(index, /consent\.css/);
assert.match(index, /consent v2026-09-18/);

const privacy = readFileSync(join(root, "website/privacy.html"), "utf8");
assert.match(privacy, /Chrysalis/);
assert.match(privacy, /opt-in/i);
assert.match(privacy, /consent\.js/);

const terms = readFileSync(join(root, "website/terms.html"), "utf8");
assert.match(terms, /Process consent/);
assert.match(terms, /BYOK/);
assert.match(terms, /consent\.js/);

console.log("test_legal_01_consent.mjs: OK");
