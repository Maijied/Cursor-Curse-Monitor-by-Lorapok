#!/usr/bin/env node
/**
 * Embeds package.json product context for Cloudflare Pages functions (no fs at runtime).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProductContext } from "./lib-product-context.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "website/admin/functions/api/_shared/product-context.embedded.json");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const ctx = buildProductContext(pkg);

writeFileSync(
  out,
  JSON.stringify(
    {
      version: pkg.version,
      displayName: pkg.displayName ?? pkg.name,
      ctx,
    },
    null,
    2
  ) + "\n"
);

console.log(`Wrote ${out} (v${pkg.version})`);
