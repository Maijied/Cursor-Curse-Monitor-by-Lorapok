import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMailTemplates } from "../../../../../scripts/mail-templates.mjs";
import { buildProductContext } from "../../../../../scripts/lib-product-context.mjs";

const rootPkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../../../package.json"), "utf8")
);

const ctx = buildProductContext(rootPkg);

export function getMailTemplates() {
  return buildMailTemplates(ctx);
}
