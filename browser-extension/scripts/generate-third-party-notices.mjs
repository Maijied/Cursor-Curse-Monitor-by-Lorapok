#!/usr/bin/env node
/**
 * Regenerate browser-extension/THIRD_PARTY_NOTICES.md from bundled dependency LICENSE files.
 * Run after npm install in browser-extension (or repo root with hoisted deps).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(root, "..");

function resolveLicense(pkgName, relPaths) {
  for (const rel of relPaths) {
    const p = join(root, rel);
    if (existsSync(p)) return readFileSync(p, "utf8").trim();
  }
  for (const rel of relPaths) {
    const p = join(repoRoot, rel);
    if (existsSync(p)) return readFileSync(p, "utf8").trim();
  }
  return null;
}

const react = resolveLicense("react", ["node_modules/react/LICENSE"]);
const reactDom = resolveLicense("react-dom", ["node_modules/react-dom/LICENSE"]);
const polyfill = resolveLicense("webextension-polyfill", [
  "node_modules/webextension-polyfill/LICENSE",
  "../node_modules/webextension-polyfill/LICENSE",
]);

const missing = [];
if (!react) missing.push("react/LICENSE");
if (!reactDom) missing.push("react-dom/LICENSE");
if (!polyfill) missing.push("webextension-polyfill/LICENSE");
if (missing.length) {
  console.error("::error::Missing dependency license files:", missing.join(", "));
  console.error("Run npm install in browser-extension (or repo root) first.");
  process.exit(1);
}

const body = `# Third-party license notices — Cursor Curse Monitor browser extension

This file is included in Firefox and Chrome extension packages (\`browser-extension/dist/\`).
Lorapok original code is MPL-2.0 (see package \`LICENSE\`). Summaries also appear in \`NOTICE.md\`.

---

## react (npm package)

Source: https://github.com/facebook/react

${react}

---

## react-dom (npm package)

Source: https://github.com/facebook/react

${reactDom}

---

## webextension-polyfill (npm package)

Source: https://github.com/mozilla/webextension-polyfill

${polyfill}
`;

const out = join(root, "THIRD_PARTY_NOTICES.md");
writeFileSync(out, body, "utf8");
console.log("Wrote", out);
