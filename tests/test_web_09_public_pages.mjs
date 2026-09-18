/**
 * WEB-09: public multi-page site shells + wiki generator contract.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mapWikiHref, wikiMarkdownToHtml } from "../scripts/lib/wiki-markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

assert.equal(mapWikiHref("Installation"), "Installation.html");
assert.equal(mapWikiHref("Home"), "index.html");
assert.equal(mapWikiHref("https://lorapok.tech"), "https://lorapok.tech");
assert.match(wikiMarkdownToHtml("# Hello\n\n**bold** and `code`"), /<h1 id="hello">Hello<\/h1>/);
assert.match(wikiMarkdownToHtml("| A | B |\n| --- | --- |\n| 1 | 2 |"), /<table>/);

for (const rel of [
  "website/releases.html",
  "website/community.html",
  "website/docs/index.html",
  "website/wiki/index.html",
  "website/public-pages.js",
  "website/public-pages.css",
  "scripts/generate-public-pages.mjs",
]) {
  assert.ok(existsSync(join(root, rel)), `missing ${rel}`);
}

const wikiPages = readdirSync(join(root, "website/wiki")).filter((f) => f.endsWith(".html"));
assert.ok(wikiPages.length >= 10, `expected wiki HTML pages, got ${wikiPages.length}`);

const releases = readFileSync(join(root, "website/releases.html"), "utf8");
assert.match(releases, /public-pages\.js/);
assert.match(releases, /id="public-releases"/);

const community = readFileSync(join(root, "website/community.html"), "utf8");
assert.match(community, /id="public-community"/);

const index = readFileSync(join(root, "website/index.html"), "utf8");
assert.match(index, /href="wiki\/"/);
assert.match(index, /href="releases\.html"/);
assert.match(index, /href="community\.html"/);
assert.match(index, /href="docs\/"/);

const seo = readFileSync(join(root, "website/seo.yml"), "utf8");
assert.match(seo, /\n  wiki:/);
assert.match(seo, /\n  releases:/);
assert.match(seo, /\n  community:/);
assert.match(seo, /\n  docs:/);

console.log("test_web_09_public_pages.mjs: OK");
