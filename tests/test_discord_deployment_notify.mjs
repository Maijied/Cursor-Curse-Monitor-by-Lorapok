import assert from "node:assert/strict";
import {
  buildDiscordNotifyPayload,
  parseDiscordNotifyArgs,
} from "../scripts/discord-deployment-notify.mjs";

const payload = buildDiscordNotifyPayload({
  conclusion: "failure",
  target: "Deploy Marketing Website",
  actionType: "deploy-infra - Deploy Mission Control admin & marketing site",
  tag: "v1.0.56",
  summary: "Marketing website deploy failed",
  runUrl: "https://github.com/example/actions/runs/1",
  deployUrl: "https://cursor.lorapok.tech/",
});

assert.equal(payload.conclusion, "failure");
assert.equal(payload.jobs[0].name, "Deploy Marketing Website");
assert.equal(payload.tag, "v1.0.56");
assert.match(String(payload.summary), /failed/);

const parsed = parseDiscordNotifyArgs([
  "node",
  "discord-deployment-notify.mjs",
  "--conclusion",
  "success",
  "--target",
  "Admin Panel",
]);
assert.equal(parsed.conclusion, "success");
assert.equal(parsed.target, "Admin Panel");

console.log("test_discord_deployment_notify.mjs: OK");
