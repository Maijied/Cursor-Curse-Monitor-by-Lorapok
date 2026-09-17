import assert from "node:assert/strict";
import {
  buildGithubEventSummary,
  buildGithubWebhookDiscordEmbed,
  buildGithubWebhookSocialText,
  fanOutGithubWebhookSocial,
  shouldFanOutGithubDiscord,
  shouldFanOutWorkflowRun,
} from "./github-webhook-fanout.js";

const releasePayload = {
  action: "published",
  release: {
    tag_name: "v1.0.161",
    name: "v1.0.161",
    html_url: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v1.0.161",
  },
  repository: { full_name: "Maijied/Cursor-Curse-Monitor-by-Lorapok" },
};

const embed = buildGithubWebhookDiscordEmbed({
  event: "release",
  payload: releasePayload,
  summary: buildGithubEventSummary("release", releasePayload),
});
assert.equal(embed.title, "Release");
assert.equal(embed.url, releasePayload.release.html_url);
assert.match(embed.footer.text, /github-log/);

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

assert.equal(
  shouldFanOutWorkflowRun({
    workflow_run: { status: "in_progress", conclusion: null },
  }),
  false
);
assert.equal(
  shouldFanOutWorkflowRun({
    workflow_run: { status: "completed", conclusion: "success", name: "Production Deployment" },
  }),
  true
);
assert.equal(
  shouldFanOutGithubDiscord({
    event: "workflow_run",
    payload: { workflow_run: { status: "in_progress" } },
  }),
  false
);

const wfPayload = {
  sender: { login: "Maijied" },
  repository: { full_name: "Maijied/Cursor-Curse-Monitor-by-Lorapok" },
  workflow_run: {
    name: "Production Deployment",
    status: "completed",
    conclusion: "success",
    head_branch: "main",
    run_number: 42,
    event: "push",
    actor: { login: "Maijied" },
    html_url: "https://github.com/example/actions/runs/1",
    run_started_at: "2026-09-17T19:30:00.000Z",
    updated_at: "2026-09-17T19:31:35.000Z",
  },
};
const wfSummary = buildGithubEventSummary("workflow_run", wfPayload);
assert.match(wfSummary, /Production Deployment/);
assert.match(wfSummary, /success/);
assert.match(wfSummary, /main/);
assert.match(wfSummary, /@Maijied/);

const wfEmbed = buildGithubWebhookDiscordEmbed({
  event: "workflow_run",
  payload: wfPayload,
  summary: wfSummary,
});
assert.match(wfEmbed.title, /succeeded/);
assert.ok(wfEmbed.fields.some((f) => f.name === "Duration"));
assert.ok(wfEmbed.fields.some((f) => f.name === "Branch"));

console.log("github-webhook-fanout.test.mjs: OK");
