/**
 * CHRYS-01 — Chrysalis brand contract + Larvae SVG sync with website shell.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHRYSALIS_BRAND,
  CHRYSALIS_COPY,
  CHRYSALIS_LEGACY_ROOT_ID,
  CHRYSALIS_ROOT_ID,
  chrysalisShellContract,
  larvaeSvgMarkup,
  LARVAE_VIEWBOX,
} from "../dist/chrysalis.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const websiteJs = readFileSync(join(repoRoot, "website/ccm-floating-assistant.js"), "utf8");
const websiteCss = readFileSync(join(repoRoot, "website/ccm-floating-assistant.css"), "utf8");
const adminFab = readFileSync(
  join(repoRoot, "website/admin/src/components/ui/ChrysalisFab.tsx"),
  "utf8"
);
const privacyHtml = readFileSync(join(repoRoot, "website/privacy.html"), "utf8");
const termsHtml = readFileSync(join(repoRoot, "website/terms.html"), "utf8");
const indexHtml = readFileSync(join(repoRoot, "website/index.html"), "utf8");

assert.equal(CHRYSALIS_BRAND.name, "Chrysalis");
assert.match(CHRYSALIS_COPY.panelTitle, /Chrysalis/);
assert.equal(CHRYSALIS_ROOT_ID, "ccm-chrysalis");
assert.equal(CHRYSALIS_LEGACY_ROOT_ID, "ccm-floating-ai");
assert.equal(LARVAE_VIEWBOX, "0 0 64 88");

const contract = chrysalisShellContract();
assert.equal(contract.rootId, CHRYSALIS_ROOT_ID);
assert.equal(contract.brand.name, "Chrysalis");

const svg = larvaeSvgMarkup({ width: 36, className: "larvae-loader-root ccm-chrysalis-larvae" });
assert.match(svg, /viewBox="0 0 64 88"/);
assert.match(svg, /larvae-eye/);
assert.match(svg, /larvae-segment-1/);
assert.match(svg, /ccm-chrysalis-larvae/);

assert.match(websiteJs, /ccm-chrysalis/);
assert.match(websiteJs, /Chrysalis/);
assert.match(websiteJs, /viewBox="0 0 64 88"/);
assert.match(websiteJs, /larvae-eye/);
assert.match(websiteCss, /ccm-chrysalis|ccm-floating-ai/);

assert.match(adminFab, /CHRYSALIS_COPY/);
assert.match(adminFab, /larvaeSvgMarkup/);

for (const html of [indexHtml, privacyHtml, termsHtml]) {
  assert.match(html, /ccm-floating-assistant\.js/);
  assert.match(html, /ccm-floating-assistant\.css/);
  assert.match(html, /larvae-loader\.css/);
}

console.log("chrysalis.test.mjs: ok");
