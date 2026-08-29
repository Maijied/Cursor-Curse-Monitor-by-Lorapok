#!/usr/bin/env node
/**
 * Embeds package.json product context and pre-built catalogs for Cloudflare Pages
 * functions (no fs or repo-root script imports at runtime).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProductContext } from "./lib-product-context.mjs";
import { buildMailTemplates } from "./mail-templates.mjs";
import { buildMessageCatalog } from "./message-cards.mjs";
import {
  buildBuiltinNotices,
  buildGeneratedCatalogNotice,
  buildNoticeTemplates,
} from "./notice-templates.mjs";
import { bakePlaceholders } from "../website/admin/functions/api/_shared/template-interpolate.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "website/admin/functions/api/_shared/product-context.embedded.json");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const siteDataPath = join(root, "website", "site-data.json");
let publishedReleaseVersion = null;
if (existsSync(siteDataPath)) {
  try {
    const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));
    publishedReleaseVersion = siteData.publishedReleaseVersion ?? null;
  } catch {
    publishedReleaseVersion = null;
  }
}
const ctx = buildProductContext(pkg, { publishedReleaseVersion });
const builtinNotices = buildBuiltinNotices(pkg);
const generatedDevNotice = buildGeneratedCatalogNotice(ctx);
const noticeTemplates = buildNoticeTemplates(ctx);
const mailTemplates = buildMailTemplates(ctx);
const messageCatalog = buildMessageCatalog(ctx);

const recovery = builtinNotices.find((n) => n.id === "conversation-recovery-v0515") ?? builtinNotices[1];
const rollback = builtinNotices.find((n) => n.id === "rollback-recovery-notice") ?? builtinNotices[2];

const placeholderCtx = { ...ctx, releaseTag: `v${ctx.releaseVersion ?? ctx.version}` };

writeFileSync(
  out,
  JSON.stringify(
    {
      version: pkg.version,
      displayName: pkg.displayName ?? pkg.name,
      ctx: placeholderCtx,
      messageCatalog: bakePlaceholders(messageCatalog, placeholderCtx),
      mailTemplates: bakePlaceholders(mailTemplates, placeholderCtx),
      noticeTemplates: bakePlaceholders(noticeTemplates, placeholderCtx),
      builtinNotices: bakePlaceholders(builtinNotices, placeholderCtx),
      generatedDevNotice: bakePlaceholders(generatedDevNotice, placeholderCtx),
      conversationRecoveryNotice: bakePlaceholders(recovery, placeholderCtx),
      rollbackNotice: bakePlaceholders(rollback, placeholderCtx),
    },
    null,
    2
  ) + "\n"
);

console.log(`Wrote ${out} (v${pkg.version}, ${mailTemplates.length} mail templates, ${noticeTemplates.length} notice templates)`);
