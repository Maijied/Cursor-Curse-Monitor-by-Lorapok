import assert from "node:assert/strict";
import {
  identityEmail,
  normalizeEmailIdentitiesConfig,
  upsertIdentity,
  validateIdentityLocalPart,
} from "./email-identities-config.js";

assert.equal(identityEmail("cursor.monitor"), "cursor.monitor@lorapok.tech");

const valid = validateIdentityLocalPart("cursor.monitor");
assert.equal(valid.ok, true);

const invalid = validateIdentityLocalPart("bad..name");
assert.equal(invalid.ok, false);

const reserved = validateIdentityLocalPart("postmaster");
assert.equal(reserved.ok, false);

const config = normalizeEmailIdentitiesConfig({
  identities: [
    {
      localPart: "releases",
      displayName: "Releases",
      category: "product",
      forwardTo: "ops@example.com",
      routingStatus: "provisioned",
    },
  ],
});

assert.ok(config.identities.some((item) => item.localPart === "cursor.monitor"));
assert.ok(config.identities.some((item) => item.localPart === "releases"));

const updated = upsertIdentity(config, "releases", { displayName: "Release Bot" });
assert.equal(updated.identities.find((i) => i.localPart === "releases")?.displayName, "Release Bot");

console.log("email-identities-config.test.mjs: OK");
