/**
 * WEB-10 — contributor welcome URLs + surface wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GITHUB_CONTRIBUTING_URL,
  GITHUB_GOOD_FIRST_ISSUES_URL,
  GITHUB_PROJECT_BOARD_URL,
  CONTRIBUTE_CTA_LABEL,
  CONTRIBUTE_CTA_HINT,
} from "../dist/productLinks.js";
import { CHRYSALIS_COPY } from "../dist/chrysalis.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

assert.match(GITHUB_CONTRIBUTING_URL, /CONTRIBUTING\.md$/);
assert.match(GITHUB_GOOD_FIRST_ISSUES_URL, /good\+first\+issue/);
assert.equal(GITHUB_PROJECT_BOARD_URL, "https://github.com/users/Maijied/projects/4");
assert.equal(CONTRIBUTE_CTA_LABEL, "Join the community");
assert.match(CONTRIBUTE_CTA_HINT, /CONTRIBUTING/);
assert.match(CHRYSALIS_COPY.contributeBlurb, /CONTRIBUTING/);

const indexHtml = readFileSync(join(repoRoot, "website/index.html"), "utf8");
assert.match(indexHtml, /hero-contribute/);
assert.match(indexHtml, /subscribe-contribute/);
assert.match(indexHtml, /data-footer-contribute/);

const socialFooter = readFileSync(join(repoRoot, "website/social-footer.js"), "utf8");
assert.match(socialFooter, /applyContributeLinks/);

const dashboard = readFileSync(join(repoRoot, "src/dashboardView.ts"), "utf8");
assert.match(dashboard, /GITHUB_CONTRIBUTING_URL/);

const browserFooter = readFileSync(join(repoRoot, "browser-extension/src/components/Footer.tsx"), "utf8");
assert.match(browserFooter, /CONTRIBUTE_CTA_LABEL/);

const options = readFileSync(join(repoRoot, "browser-extension/src/options/OptionsApp.tsx"), "utf8");
assert.match(options, /GITHUB_CONTRIBUTING_URL/);

console.log("productLinks WEB-10 OK");
