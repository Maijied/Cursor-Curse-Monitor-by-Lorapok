#!/usr/bin/env node
/**
 * Embeds package.json product context and pre-built catalogs for Cloudflare Pages
 * functions (no fs or repo-root script imports at runtime).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProductContext } from "./lib-product-context.mjs";
import { buildMailTemplates } from "./mail-templates.mjs";
import {
  buildBuiltinNotices,
  buildGeneratedCatalogNotice,
  buildNoticeTemplates,
} from "./notice-templates.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "website/admin/functions/api/_shared/product-context.embedded.json");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const ctx = buildProductContext(pkg);
const builtinNotices = buildBuiltinNotices(pkg);
const generatedDevNotice = buildGeneratedCatalogNotice(ctx);
const noticeTemplates = buildNoticeTemplates(ctx);
const mailTemplates = buildMailTemplates(ctx);

const recovery = builtinNotices.find((n) => n.id === "conversation-recovery-v0515") ?? builtinNotices[1];
const rollback = builtinNotices.find((n) => n.id === "rollback-recovery-notice") ?? builtinNotices[2];

writeFileSync(
  out,
  JSON.stringify(
    {
      version: pkg.version,
      displayName: pkg.displayName ?? pkg.name,
      ctx,
      mailTemplates,
      noticeTemplates,
      builtinNotices,
      generatedDevNotice,
      conversationRecoveryNotice: recovery,
      rollbackNotice: rollback,
    },
    null,
    2
  ) + "\n"
);

console.log(`Wrote ${out} (v${pkg.version}, ${mailTemplates.length} mail templates, ${noticeTemplates.length} notice templates)`);
