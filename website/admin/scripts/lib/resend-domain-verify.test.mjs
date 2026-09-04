import assert from "node:assert/strict";
import {
  auditCloudflareDns,
  isResendDomainVerified,
  summarizeResendDomain,
} from "./resend-domain-verify.mjs";

assert.equal(isResendDomainVerified("verified"), true);
assert.equal(isResendDomainVerified("partially_verified"), true);
assert.equal(isResendDomainVerified("pending"), false);

const summary = summarizeResendDomain({
  id: "d1",
  name: "mail.lorapok.tech",
  status: "verified",
  records: [{ record: "DKIM", name: "resend._domainkey.mail", type: "TXT", status: "verified", value: "p=abc" }],
});
assert.equal(summary?.verified, true);
assert.equal(summary?.name, "mail.lorapok.tech");

const dnsOk = auditCloudflareDns(
  [
    { name: "resend._domainkey.mail", type: "TXT", content: "p=...", proxied: false },
    { name: "send.mail", type: "MX", content: "feedback-smtp.eu-west-1.amazonses.com", proxied: false },
    { name: "send.mail", type: "TXT", content: "v=spf1 include:amazonses.com ~all", proxied: false },
    { name: "mail", type: "MX", content: "inbound-smtp.eu-west-1.amazonaws.com", proxied: false },
  ],
  "mail.lorapok.tech"
);
assert.equal(dnsOk.ok, true);

const dnsMissing = auditCloudflareDns(
  [{ name: "resend._domainkey.mail", type: "TXT", content: "p=...", proxied: false }],
  "mail.lorapok.tech"
);
assert.equal(dnsMissing.ok, false);

console.log("resend-domain-verify.test.mjs: OK");
