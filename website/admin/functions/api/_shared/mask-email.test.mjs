#!/usr/bin/env node
import assert from "node:assert/strict";
import { extractEmailAddress, maskEmail, maskEmailDisplay } from "./mask-email.js";

assert.equal(extractEmailAddress("Cursor Monitor <cursor.monitor@lorapok.tech>"), "cursor.monitor@lorapok.tech");
assert.equal(extractEmailAddress("user@gmail.com"), "user@gmail.com");

assert.equal(maskEmail("admin@lorapok.tech"), "xxx@lorapok.tech");
assert.equal(maskEmail("cursor.monitor@lorapok.tech"), "xxx@lorapok.tech");
assert.equal(maskEmail("imaizied@gmail.com"), "i***@gmail.com");
assert.equal(maskEmail("a@test.com"), "a***@test.com");
assert.equal(maskEmail("Cursor <ops@lorapok.tech>"), "xxx@lorapok.tech");
assert.equal(maskEmailDisplay("Cursor Monitor <cursor.monitor@lorapok.tech>"), "Cursor Monitor <xxx@lorapok.tech>");

console.log("mask-email.test.mjs: OK");
