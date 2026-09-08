import assert from "node:assert/strict";
import {
  buildDiscordNotifyPayload,
  normalizeVersionTag,
  parseDiscordNotifyArgs,
  readVersionFromSiteData,
  resolveDeployNotifyTag,
  shouldRequireDiscordWebhook,
} from "../scripts/discord-deployment-notify.mjs";
import { readDeploymentWebhookFromDiscordConfig } from "../scripts/lib/resolve-discord-deployment-webhook.mjs";
import { buildLocalDeployEnrichment } from "../scripts/discord-ci-enrichment.mjs";
import { buildDeploymentEmbed } from "../website/admin/functions/api/_shared/discord-notify.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const payload = buildDiscordNotifyPayload({
  conclusion: "failure",
  target: "Deploy Marketing Website",
  actionType: "deploy-infra - Deploy Mission Control admin & marketing site",
  tag: "v1.0.56",
  summary: "Marketing website deploy failed",
  runUrl: "https://github.com/example/actions/runs/1",
  deployUrl: "https://cursor.lorapok.tech/",
  failedStep: "Deploy Marketing Website / GitHub Pages",
});

assert.equal(payload.conclusion, "failure");
assert.equal(payload.jobs[0].name, "Deploy Marketing Website");
assert.equal(payload.tag, "v1.0.56");
assert.equal(payload.failedStep, "Deploy Marketing Website / GitHub Pages");
assert.match(String(payload.summary), /failed/);

const parsed = parseDiscordNotifyArgs([
  "node",
  "discord-deployment-notify.mjs",
  "--conclusion",
  "success",
  "--target",
  "Admin Panel",
  "--duration",
  "4m 12s",
]);
assert.equal(parsed.conclusion, "success");
assert.equal(parsed.target, "Admin Panel");
assert.equal(parsed.duration, "4m 12s");

assert.equal(normalizeVersionTag("1.0.56"), "v1.0.56");
assert.equal(normalizeVersionTag("v1.0.56"), "v1.0.56");
assert.equal(normalizeVersionTag("0.0.0"), null);

const siteVersion = readVersionFromSiteData(root);
assert.ok(siteVersion, "expected version from committed site-data.json");
assert.match(resolveDeployNotifyTag({ repoRoot: root }), /^v\d+\.\d+\.\d+/);
assert.equal(
  resolveDeployNotifyTag({ tag: "v9.9.9", repoRoot: root }),
  "v9.9.9",
);
assert.equal(shouldRequireDiscordWebhook({ requireWebhook: "1" }), true);
assert.equal(shouldRequireDiscordWebhook({}), process.env.GITHUB_ACTIONS === "true");

assert.equal(
  readDeploymentWebhookFromDiscordConfig({
    deploymentWebhookUrl: "https://discord.com/api/webhooks/123/abc-def",
  }),
  "https://discord.com/api/webhooks/123/abc-def",
);
assert.equal(
  readDeploymentWebhookFromDiscordConfig({
    webhookUrl: "https://discord.com/api/webhooks/456/legacy-token",
  }),
  "https://discord.com/api/webhooks/456/legacy-token",
);
assert.equal(readDeploymentWebhookFromDiscordConfig({ deploymentWebhookUrl: "not-a-webhook" }), "");

const enrichment = buildLocalDeployEnrichment({ tag: "v1.0.56", repoRoot: root });
assert.ok(
  !String(enrichment.catalogBrand?.discordAvatarUrl ?? "").includes("{{"),
  "catalogBrand.discordAvatarUrl must be hydrated for CI Discord notify",
);
assert.match(
  String(enrichment.catalogBrand?.discordAvatarUrl ?? ""),
  /^https:\/\//,
);
const embed = buildDeploymentEmbed(payload, enrichment);
assert.equal(embed.title, "❌ Deployment failed");
assert.match(String(embed.description), /What's new|Release sync|rollback|Rollback/i);

console.log("test_discord_deployment_notify.mjs: OK");
