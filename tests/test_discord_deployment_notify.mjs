import assert from "node:assert/strict";
import {
  buildDiscordNotifyPayload,
  parseDiscordNotifyArgs,
} from "../scripts/discord-deployment-notify.mjs";
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

const enrichment = buildLocalDeployEnrichment({ tag: "v1.0.56", repoRoot: root });
const embed = buildDeploymentEmbed(payload, enrichment);
assert.equal(embed.title, "❌ Deployment failed");
assert.match(String(embed.description), /What's new|Release sync|rollback|Rollback/i);

console.log("test_discord_deployment_notify.mjs: OK");
