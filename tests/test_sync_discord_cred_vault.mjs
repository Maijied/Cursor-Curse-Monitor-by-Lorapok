import assert from "node:assert/strict";
import { resolveDiscordWebhooksFromVault } from "../website/admin/scripts/lib/cred-vault-sync.mjs";
import { mergeDiscordConfig } from "../scripts/sync-discord-cred-vault.mjs";

const hooks = resolveDiscordWebhooksFromVault({
  cursor: {
    discord_community_webhook_url: "https://discord.com/api/webhooks/1/communitytokenxxxxx",
    discord_deployment_webhook_url: "https://discord.com/api/webhooks/2/deploymenttokenxxxx",
    discord_github_log_webhook_url: "https://discord.com/api/webhooks/3/githublogtokenxxxxxx",
    discord_feedback_webhook_url: "https://discord.com/api/webhooks/4/feedbacktokenxxxxxxx",
  },
});
assert.ok(hooks.community?.includes("/1/"));
assert.ok(hooks.deployment?.includes("/2/"));
assert.ok(hooks.githubLog?.includes("/3/"));
assert.ok(hooks.feedback?.includes("/4/"));

const { next, changed } = mergeDiscordConfig(
  { communityWebhookUrl: "", deploymentWebhookUrl: "", feedbackWebhookUrl: "", githubLogWebhookUrl: "" },
  {
    community: hooks.community,
    deployment: hooks.deployment,
    githubLog: hooks.githubLog,
    feedback: hooks.feedback,
  }
);
assert.equal(changed, true);
assert.equal(next.communityWebhookUrl, hooks.community);
assert.equal(next.githubLogWebhookUrl, hooks.githubLog);

console.log("test_sync_discord_cred_vault.mjs: OK");
