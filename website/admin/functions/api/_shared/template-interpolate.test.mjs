#!/usr/bin/env node
import assert from "node:assert/strict";
import { bakePlaceholders, interpolateDeep } from "./template-interpolate.js";

const ctx = {
  releaseVersion: "1.0.34",
  releaseUrl: "https://github.com/org/repo/releases/tag/v1.0.34",
  displayName: "Cursor Curse Monitor by Lorapok",
  adminUrl: "https://cursor-dev.lorapok.tech",
};

const baked = bakePlaceholders(
  {
    label: `Feature release — v${ctx.releaseVersion}`,
    message: `Update: ${ctx.releaseUrl}\n${ctx.displayName}`,
  },
  ctx
);

assert.equal(baked.label, "Feature release — v{{releaseVersion}}");
assert.equal(baked.message, "Update: {{releaseUrl}}\n{{displayName}}");

const live = {
  releaseVersion: "1.0.51",
  releaseUrl: "https://github.com/org/repo/releases/tag/v1.0.51",
  displayName: "Cursor Curse Monitor by Lorapok",
};

const hydrated = interpolateDeep(baked, live);
assert.equal(hydrated.label, "Feature release — v1.0.51");
assert.ok(hydrated.message.includes("v1.0.51"));

console.log("template-interpolate.test.mjs: OK");
