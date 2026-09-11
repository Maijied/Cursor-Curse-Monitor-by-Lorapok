import assert from "node:assert/strict";
import {
  mergeLiveProbeChecks,
  selectLiveProbeTargets,
} from "./mail-deliverability-live-probe.js";

const rows = [
  { address: "cursor.monitor@lorapok.tech", source: "mail-config.product", ok: true, checks: [] },
  { address: "cursor.curse.help@lorapok.tech", source: "mail-config.support", ok: true, checks: [] },
  { address: "noreply@lorapok.tech", source: "identity.ops", ok: true, checks: [] },
];

const targets = selectLiveProbeTargets(rows);
assert.equal(targets.length, 2);
assert.equal(targets[0].source, "mail-config.product");

const merged = mergeLiveProbeChecks(rows, {
  skipped: false,
  probes: [
    {
      address: "cursor.monitor@lorapok.tech",
      check: { id: "liveSend", ok: true, detail: "ok" },
    },
  ],
});
assert.equal(merged[0].ok, true);
assert.equal(merged[0].checks.length, 1);
assert.equal(merged[1].ok, true);

console.log("mail-deliverability-live-probe.test.mjs: OK");
