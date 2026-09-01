import assert from "node:assert/strict";
import { buildMailSyncRecommendations } from "../functions/api/_shared/mail-sync.js";

const recRelay = buildMailSyncRecommendations({
  configured: false,
  transport: "none",
  relayBound: false,
  resendConfigured: false,
});
assert.ok(recRelay.some((line) => /deploy-infra|MAIL_RELAY|enable-mail/i.test(line)));
assert.ok(recRelay.some((line) => /RESEND_API_KEY/i.test(line)));

const recHealthy = buildMailSyncRecommendations({
  configured: true,
  transport: "cloudflare-relay",
  relayBound: true,
  resendConfigured: true,
});
assert.equal(recHealthy.length, 0);

console.log("mail-sync.test.mjs: OK");
