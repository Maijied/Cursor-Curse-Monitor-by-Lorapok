import assert from "node:assert/strict";
import {
  extractForwardTarget,
  findRoutingRuleForAddress,
} from "./cloudflare-email-routing.js";

const rules = [
  {
    id: "rule-1",
    matchers: [{ field: "to", value: "admin@lorapok.tech" }],
    actions: [{ type: "forward", value: ["lorapokdev@gmail.com"] }],
  },
  {
    id: "rule-2",
    matchers: [{ field: "to", value: "cursor.monitor@lorapok.tech" }],
    actions: [{ type: "forward", value: ["mdshuvo40@gmail.com"] }],
  },
];

assert.equal(extractForwardTarget(rules[0]), "lorapokdev@gmail.com");
assert.equal(extractForwardTarget(rules[1]), "mdshuvo40@gmail.com");
assert.equal(extractForwardTarget({ actions: [] }), null);
assert.ok(findRoutingRuleForAddress(rules, "admin@lorapok.tech"));

console.log("cloudflare-email-routing.test.mjs: OK");
