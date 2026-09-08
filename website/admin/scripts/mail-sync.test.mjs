import assert from "node:assert/strict";
import { buildMailSyncRecommendations } from "../functions/api/_shared/mail-sync.js";

const recRelay = buildMailSyncRecommendations(
  {
    configured: false,
    transport: "none",
    relayBound: false,
    resendConfigured: false,
  },
  { workersFreeMode: false }
);
assert.ok(recRelay.some((line) => /deploy-infra|MAIL_RELAY|enable-mail/i.test(line)));
assert.ok(recRelay.some((line) => /RESEND_API_KEY/i.test(line)));

const recInbound = buildMailSyncRecommendations(
  { configured: true, transport: "cloudflare-relay", relayBound: true, resendConfigured: true },
  { workersFreeMode: true },
  {
    summary: { inboundReady: 1, pending: 2, error: 0, total: 3 },
    routingApiConfigured: false,
  }
);
assert.ok(recInbound.some((line) => /Inbound routing/i.test(line)));
assert.ok(recInbound.some((line) => /CLOUDFLARE_ROUTING_API_TOKEN/i.test(line)));

const recHealthy = buildMailSyncRecommendations(
  {
    configured: true,
    transport: "cloudflare-relay",
    relayBound: true,
    resendConfigured: true,
  },
  { workersFreeMode: true, resendDomainVerified: true }
);
assert.equal(recHealthy.length, 0);

console.log("mail-sync.test.mjs: OK");
