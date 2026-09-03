import assert from "node:assert/strict";
import { resolveBadgeKind } from "./badge-endpoint.js";

assert.equal(resolveBadgeKind("total"), "total");
assert.equal(resolveBadgeKind("openvsx-total"), "openvsx-total");
assert.equal(resolveBadgeKind("vscode"), "vscode");
assert.equal(resolveBadgeKind("bogus"), "total");
assert.equal(resolveBadgeKind(undefined), "total");

console.log("badge-endpoint.test.mjs: OK");
