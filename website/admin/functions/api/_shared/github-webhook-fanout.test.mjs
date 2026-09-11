import assert from "node:assert/strict";
import {
  buildGithubWebhookDiscordEmbed,
  buildGithubWebhookSocialText,
  fanOutGithubWebhookSocial,
} from "./github-webhook-fanout.js";

const releasePayload = {
  action: "published",
  release: { tag_name: "v1.0.161", html_url: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v1.0.161" },
  repository: { full_name: "Maijied/Cursor-Curse-Monitor-by-Lorapok" },
};

const embed = buildGithubWebhookDiscordEmbed({
  event: "release",
  payload: releasePayload,
  summary: "release v1.0.161 (published)",
});
assert.equal(embed.title, "🏷️ GitHub release");
assert.equal(embed.url, releasePayload.release.html_url);
assert.ok(embed.fields.some((f) => f.name === "Event" && f.value === "release"));

const socialText = buildGithubWebhookSocialText({
  event: "release",
  payload: releasePayload,
  summary: "release v1.0.161",
});
assert.match(socialText, /v1\.0\.161/);
assert.match(socialText, /releases\/tag/);

const pushSkip = await fanOutGithubWebhookSocial({}, { event: "push", payload: {}, summary: "push main" });
assert.equal(pushSkip.skipped, true);
assert.equal(pushSkip.reason, "social_release_only");

console.log("github-webhook-fanout.test.mjs: OK");
