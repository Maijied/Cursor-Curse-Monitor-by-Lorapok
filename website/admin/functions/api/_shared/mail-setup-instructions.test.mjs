import assert from "node:assert/strict";
import { buildMailSetupInstructions } from "./mail-setup-instructions.js";
import { normalizeMailConfig } from "./mail-config.js";

const config = normalizeMailConfig({});
const transport = {
  configured: false,
  transport: "none",
  relayBound: false,
  restConfigured: false,
  resendConfigured: false,
};

const instructions = buildMailSetupInstructions(config, transport);
assert.equal(instructions.workersFreeMode, true);
assert.equal(instructions.sendingDomain, "lorapok.tech");
assert.ok(instructions.steps.length >= 5);
assert.ok(instructions.steps.some((step) => step.id === "verify-domain"));

const ready = buildMailSetupInstructions(
  normalizeMailConfig({ resendDomainVerified: true }),
  { ...transport, configured: true, resendConfigured: true, transport: "resend" }
);
assert.ok(ready.steps.find((step) => step.id === "verify-domain")?.done);

console.log("mail-setup-instructions.test.mjs: OK");
