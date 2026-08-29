#!/usr/bin/env node
import assert from "node:assert/strict";
import { getNoticeTemplates } from "./notice-catalog.js";

const templates = await getNoticeTemplates({
  SITE_DATA_URL: "https://cursor.lorapok.tech/site-data.json",
});

const feature = templates.find((t) => t.templateId === "feature-release");
assert.ok(feature, "feature-release template exists");
assert.ok(
  !feature.label.includes("{{"),
  `expected hydrated label, got: ${feature.label}`
);
assert.match(feature.label, /v\d+\.\d+\.\d+/);

console.log("notice-hydration.test.mjs: OK", feature.label);
