/**
 * WEB-11: engineering history timeline at /engineering/history/.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const historyPath = join(root, "website/engineering/history/index.html");
const cssPath = join(root, "website/public-pages.css");
const indexPath = join(root, "website/index.html");
const sitemapPath = join(root, "website/sitemap.xml");
const genPath = join(root, "scripts/generate-public-pages.mjs");

assert.ok(existsSync(historyPath), "missing website/engineering/history/index.html");
assert.ok(existsSync(genPath), "missing generate-public-pages.mjs");

const history = readFileSync(historyPath, "utf8");
assert.match(history, /Engineering history/);
assert.match(history, /eng-history-timeline/);
assert.match(history, /id="origin"/);
assert.match(history, /id="mission-control"/);
assert.match(history, /id="procedure"/);
assert.match(history, /id="credits"/);
assert.match(history, /canonical" href="https:\/\/cursor\.lorapok\.tech\/engineering\/history\/"/);
assert.match(history, /procedure\//);
assert.match(history, /Mission Control/);

const css = readFileSync(cssPath, "utf8");
assert.match(css, /\.eng-history-timeline\b/);
assert.match(css, /\.eng-history-item\b/);

const index = readFileSync(indexPath, "utf8");
assert.match(index, /href="engineering\/history\/"/);
assert.doesNotMatch(index, /long-form history planned as WEB-11/);

const sitemap = readFileSync(sitemapPath, "utf8");
assert.match(sitemap, /engineering\/history\//);

const gen = readFileSync(genPath, "utf8");
assert.match(gen, /generateEngineeringHistory/);
assert.match(gen, /engineering\/history/);

console.log("test_web_11_engineering_history.mjs: OK");
