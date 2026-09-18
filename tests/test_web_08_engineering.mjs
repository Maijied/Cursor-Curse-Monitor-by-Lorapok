/**
 * WEB-08: marketing site must expose #engineering behind-the-scenes section.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "website/index.html"), "utf8");
const css = readFileSync(join(root, "website/styles.css"), "utf8");

assert.match(html, /id="engineering"/);
assert.match(html, /href="#engineering"/);
assert.match(html, /Behind the scenes/);
assert.match(html, /Cred vault/);
assert.match(html, /Procedure \+ Project #4/);
assert.match(html, /Release integrity/);
assert.match(html, /CONTRIBUTING\.md/);
assert.match(html, /Update\?/);
assert.match(html, />next</);
assert.match(css, /\.engineering-section\b/);
assert.match(css, /\.engineering-surfaces\b/);
assert.match(css, /\.engineering-topics\b/);

console.log("test_web_08_engineering.mjs: OK");
