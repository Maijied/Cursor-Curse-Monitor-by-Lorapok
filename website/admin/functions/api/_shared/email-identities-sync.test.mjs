import assert from "node:assert/strict";
import { findRoutingRuleForAddress } from "./cloudflare-email-routing.js";
import { syncEmailIdentities } from "./email-identities-sync.js";

const rules = [
  {
    id: "rule-1",
    matchers: [{ field: "to", value: "cursor.monitor@lorapok.tech" }],
  },
];

assert.ok(findRoutingRuleForAddress(rules, "cursor.monitor@lorapok.tech"));
assert.equal(findRoutingRuleForAddress(rules, "missing@lorapok.tech"), undefined);

const dryRun = await syncEmailIdentities(
  {},
  {
    dryRun: true,
    persist: false,
    config: {
      domain: "lorapok.tech",
      opsForwardTo: "lorapokdev@gmail.com",
      identities: [
        {
          localPart: "cursor.monitor",
          displayName: "Cursor Curse Monitor",
          category: "product",
          forwardTo: "lorapokdev@gmail.com",
          enabled: true,
          routingStatus: "builtin",
        },
      ],
      updatedAt: null,
      updatedBy: null,
    },
  }
);

assert.equal(dryRun.ok, true);
assert.equal(dryRun.results.length, 1);
assert.equal(dryRun.results[0].routingStatus, "pending");

console.log("email-identities-sync.test.mjs: OK");
