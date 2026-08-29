import assert from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const path = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "content",
  "auth-capture.ts"
);
const src = readFileSync(path, "utf8");

assert(src.includes("api2.cursor.sh"), "auth capture must target Cursor API");
assert(src.includes("WorkosCursorSessionToken"), "must read dashboard session cookie");
assert(src.includes("tokenCaptured"), "must message background on token");
assert(src.includes("postMessage"), "must use page postMessage bridge");

console.log("test_auth_capture.js: OK");
