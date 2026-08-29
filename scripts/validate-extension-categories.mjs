#!/usr/bin/env node
/**
 * Validate package.json `categories` against VS Code Marketplace + Open VSX allow-lists.
 *
 * @see https://code.visualstudio.com/api/references/extension-manifest#marketplace-presentation-tips
 * @see https://github.com/eclipse-openvsx/openvsx/blob/master/webui/src/extension-registry-types.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));

/** Open VSX `CATEGORIES` (kept in sync with upstream registry). */
const OPEN_VSX_CATEGORIES = [
  "AI",
  "Programming Languages",
  "Snippets",
  "Linters",
  "Themes",
  "Debuggers",
  "Formatters",
  "Keymaps",
  "SCM Providers",
  "Other",
  "Extension Packs",
  "Language Packs",
  "Data Science",
  "Machine Learning",
  "Visualization",
  "Notebooks",
];

/** Extra categories accepted by VS Code Marketplace UI (may lag Open VSX). */
const VSCODE_MARKETPLACE_EXTRA = ["Azure", "Chat", "Education", "Testing"];

const ALLOWED = new Set([...OPEN_VSX_CATEGORIES, ...VSCODE_MARKETPLACE_EXTRA]);

/** First category is the primary filter in marketplace sidebars. */
const RECOMMENDED_FOR_CCM = ["AI", "Visualization"];

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const categories = pkg.categories ?? [];

let failed = false;
function fail(msg) {
  console.error(`::error::${msg}`);
  failed = true;
}

if (!Array.isArray(categories) || categories.length === 0) {
  fail("package.json must include at least one marketplace category (not only Other).");
}

for (const category of categories) {
  if (!ALLOWED.has(category)) {
    fail(
      `Unknown category "${category}". Allowed: ${[...ALLOWED].sort().join(", ")}`
    );
  }
}

if (categories.length > 5) {
  fail("Use at most 5 categories — pick only what truly applies.");
}

if (categories.includes("Other") && categories.length === 1) {
  fail('Do not use only "Other" — add a specific category such as AI or Visualization.');
}

if (categories.includes("Language Packs") && !/language pack|localization|l10n/i.test(pkg.description ?? "")) {
  console.warn(
    "::warning::Language Packs is reserved for UI locale extensions — remove unless this is a display-language pack."
  );
}

const missingRecommended = RECOMMENDED_FOR_CCM.filter((c) => !categories.includes(c));
if (missingRecommended.length) {
  console.warn(
    `::warning::Cursor Curse Monitor is usually listed under ${RECOMMENDED_FOR_CCM.join(" + ")}; missing: ${missingRecommended.join(", ")}`
  );
}

if (failed) process.exit(1);

console.log(
  `Extension categories OK: ${categories.join(", ")} (primary: ${categories[0] ?? "—"})`
);
