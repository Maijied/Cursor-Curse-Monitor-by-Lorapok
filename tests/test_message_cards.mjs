import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProductContext } from "../scripts/lib-product-context.mjs";
import {
  buildMessageCatalog,
  buildMailTemplatesFromCards,
  buildNoticeTemplatesFromCards,
} from "../scripts/message-cards.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const ctx = buildProductContext(pkg);

test("message catalog uses main logo branding", () => {
  const catalog = buildMessageCatalog(ctx);
  assert.equal(catalog.branding.mainLogoUrl, `${ctx.homepage}/assets/logo.png`);
  assert.ok(catalog.footers.discord.feedbackBlock.includes("GitHub Issues"));
  assert.ok(catalog.cards.length >= 15);
});

test("mail and notice templates derive from cards", () => {
  const mail = buildMailTemplatesFromCards(ctx);
  const notices = buildNoticeTemplatesFromCards(ctx);
  assert.ok(mail.some((t) => t.id === "subscribe-welcome"));
  assert.ok(notices.some((t) => t.templateId === "conversation-recovery"));
  assert.ok(notices.some((t) => t.templateId === "agent-editor-tip"));
});
