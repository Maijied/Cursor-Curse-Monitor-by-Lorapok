#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  coerceMailDisplayName,
  normalizeMailFromInput,
  toRestFrom,
  toWorkerFrom,
  toWorkerRecipient,
} from "../functions/api/_shared/mail-normalize.js";

assert.equal(coerceMailDisplayName(null, "Fallback"), "Fallback");
assert.equal(coerceMailDisplayName(undefined, "Fallback"), "Fallback");
assert.equal(coerceMailDisplayName({ en: "Bad" }, "Fallback"), "Fallback");
assert.equal(coerceMailDisplayName("  CCM  ", ""), "CCM");

const normalized = normalizeMailFromInput({
  email: "cursor.monitor@lorapok.tech",
  name: null,
});
assert.equal(normalized.name, "Cursor Curse Monitor");
assert.equal(normalized.email, "cursor.monitor@lorapok.tech");

assert.deepEqual(toWorkerFrom({ email: "a@b.c", name: null }), {
  email: "a@b.c",
  name: "Cursor Curse Monitor",
});
assert.deepEqual(toRestFrom({ email: "a@b.c", name: "CCM" }), {
  address: "a@b.c",
  name: "CCM",
});
assert.equal(toWorkerRecipient({ address: "u@x.y", name: null }), "u@x.y");
assert.deepEqual(toWorkerRecipient({ address: "u@x.y", name: "User" }), {
  email: "u@x.y",
  name: "User",
});

console.log("mail-normalize tests: OK");
