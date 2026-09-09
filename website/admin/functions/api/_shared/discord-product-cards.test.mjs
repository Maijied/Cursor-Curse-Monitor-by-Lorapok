import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalDeployEnrichment } from "../../../../../scripts/discord-ci-enrichment.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDiscordCommunityEmbed,
  buildDiscordDigestEmbed,
  buildDiscordFeedbackProductEmbed,
  buildDiscordProductShell,
  DISCORD_PRODUCT_COLORS,
} from "./discord-product-cards.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

test("buildDiscordProductShell includes author footer thumbnail", () => {
  const shell = buildDiscordProductShell({
    discordAuthorName: "Lorapok Mission Control",
    discordAvatarUrl: "https://cursor.lorapok.tech/assets/logo.png",
    discordFooterText: "cursor.lorapok.tech · Mission Control",
  });
  assert.ok(shell.author?.name);
  assert.ok(shell.footer?.text);
  assert.ok(shell.thumbnail?.url);
});

test("buildDiscordDigestEmbed uses digest palette and enrichment sections", async () => {
  const enrichment = buildLocalDeployEnrichment({ tag: "v1.0.3", repoRoot: root });
  enrichment.siteData = {
    downloads: { displayTotal: 1500, total: 1500 },
    marketplaceSync: { syncStatus: "synced" },
  };

  const embed = buildDiscordDigestEmbed(
    {
      actionType: "download-digest",
      tag: "v1.0.3",
      summary: "Scheduled digest preview.",
      triggeredBy: "cron",
    },
    enrichment
  );

  assert.equal(embed.title, "📊 Download & update digest");
  assert.equal(embed.color, DISCORD_PRODUCT_COLORS.digest);
  assert.match(String(embed.description), /Cursor Curse Monitor/);
  assert.match(String(embed.description), /Release sync|Reach & engagement|What's new/);
  assert.ok(embed.fields?.some((field) => field.name === "Community reach"));
});

test("buildDiscordCommunityEmbed includes join and discuss links", async () => {
  const embed = await buildDiscordCommunityEmbed({}, {
    summary: "Beta testers welcome.",
    triggeredBy: "gallery-preview",
  });

  assert.match(String(embed.title), /Lorapok Labs Family/);
  assert.equal(embed.color, DISCORD_PRODUCT_COLORS.community);
  assert.ok(embed.fields?.some((field) => field.name === "Join Discord"));
  assert.ok(embed.fields?.some((field) => field.name === "Discuss releases"));
});

test("buildDiscordFeedbackProductEmbed includes support links and metadata", async () => {
  const embed = await buildDiscordFeedbackProductEmbed({}, {
    kind: "bug",
    source: "extension",
    version: "1.0.3",
    triggeredBy: "gallery-preview",
  });

  assert.match(String(embed.title), /Feedback/);
  assert.equal(embed.color, DISCORD_PRODUCT_COLORS.feedback);
  assert.ok(embed.fields?.some((field) => field.name === "GitHub Issues"));
  assert.ok(embed.fields?.some((field) => field.name === "Kind" && field.value === "bug"));
});
