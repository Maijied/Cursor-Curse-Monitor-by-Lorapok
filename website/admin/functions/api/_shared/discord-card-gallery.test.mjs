import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DISCORD_GALLERY_ITEMS,
  buildDiscordGalleryPreview,
} from "./discord-card-gallery.js";
import { buildLocalDeployEnrichment } from "../../../../../scripts/discord-ci-enrichment.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

assert.ok(DISCORD_GALLERY_ITEMS.length >= 5);
assert.ok(DISCORD_GALLERY_ITEMS.some((item) => item.id === "deploy-success"));
assert.ok(DISCORD_GALLERY_ITEMS.some((item) => item.id === "deploy-failure"));

const enrichment = buildLocalDeployEnrichment({
  tag: "v1.0.3",
  repoRoot: root,
});
assert.ok(enrichment.marketplaceFields?.length);
assert.ok(enrichment.quickLinks?.includes("cursor.lorapok.tech"));

const successPreview = await buildDiscordGalleryPreview({}, "deploy-success");
assert.equal(successPreview?.embed.title, "✅ Deployment succeeded");
assert.match(String(successPreview?.embed.description), /Pipeline|Release sync|What's new|Links/);

const failurePreview = await buildDiscordGalleryPreview({}, "deploy-failure");
assert.equal(failurePreview?.embed.title, "❌ Deployment failed");
assert.match(String(failurePreview?.embed.description), /rollback|Rollback|Actions run/i);

console.log("discord-card-gallery.test.mjs: OK");
