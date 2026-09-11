import assert from "node:assert/strict";
import { auditMailAddress, collectMailAuditAddresses } from "./mail-deliverability-audit.js";

const env = {
  ADMIN_KV: {
    async get(key) {
      if (key === "integrations:mail") {
        return JSON.stringify({
          productEmail: "cursor.monitor@lorapok.tech",
          supportEmail: "cursor.curse.help@lorapok.tech",
          sendingDomain: "mail.lorapok.tech",
          resendDomainVerified: true,
        });
      }
      if (key === "integrations:email-identities") return null;
      return null;
    },
  },
};

const addresses = await collectMailAuditAddresses(env);
assert.ok(addresses.some((a) => a.address === "cursor.monitor@lorapok.tech"));

const transport = {
  configured: true,
  transport: "cloudflare-relay",
  relayBound: true,
  resendConfigured: true,
};
const mailConfig = {
  sendingDomain: "mail.lorapok.tech",
  resendDomainVerified: true,
};

const okRow = auditMailAddress(
  { address: "cursor.monitor@lorapok.tech", source: "test", routingStatus: "builtin" },
  { transport, mailConfig }
);
assert.equal(okRow.ok, true);

const badRow = auditMailAddress(
  { address: "bad@", source: "test" },
  { transport: { configured: false }, mailConfig }
);
assert.equal(badRow.ok, false);

console.log("mail-deliverability-audit.test.mjs: OK");
