import assert from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const footerPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "components",
  "Footer.tsx"
);
const src = readFileSync(footerPath, "utf8");

assert(src.includes("lorapok.tech"), "Footer must link Lorapok Labs");
assert(src.includes("cursor.com"), "Footer must link Cursor");
assert(src.includes("product of"), "Footer must include product attribution");

console.log("test_footer.js: OK");
