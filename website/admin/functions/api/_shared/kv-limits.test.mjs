import assert from "node:assert/strict";
import { truncateStoredText } from "./kv-limits.js";

assert.equal(truncateStoredText("hello", 10), "hello");
assert.equal(truncateStoredText("hello world", 5), "hell…");
assert.equal(truncateStoredText("x", 0), "");

console.log("kv-limits.test.mjs: OK");
