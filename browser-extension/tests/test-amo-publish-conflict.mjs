#!/usr/bin/env node
import assert from "node:assert";
import { isAmoVersionAlreadyPublished } from "../scripts/lib-amo-publish.mjs";

assert.equal(
  isAmoVersionAlreadyPublished('WebExtError: Submission failed (2): Conflict\n{\n  "version": [\n    "Version 1.0.3 already exists."\n  ]\n}'),
  true
);
assert.equal(isAmoVersionAlreadyPublished("Version 2.0.0 already exists."), true);
assert.equal(isAmoVersionAlreadyPublished("Unauthorized"), false);

console.log("test_amo_publish_conflict.mjs: OK");
