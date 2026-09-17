import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { readDiscordConfig } from "../../_shared/discord-config.js";
import { getMessageBranding } from "../../_shared/message-cards-runtime.js";
import {
  buildGithubEventSummary,
  buildGithubWebhookDiscordEmbed,
} from "../../_shared/github-webhook-fanout.js";

/**
 * Sends a sample github-log embed to the configured github-log webhook.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "integrations.write");
  if (denied) return denied;

  const config = await readDiscordConfig(env);
  if (!config.githubLogWebhookUrl) {
    return jsonResponse({ ok: true, skipped: true });
  }

  const now = new Date();
  const started = new Date(now.getTime() - 95_000);
  const payload = {
    action: "completed",
    sender: { login: "Maijied" },
    repository: {
      full_name: "Maijied/Cursor-Curse-Monitor-by-Lorapok",
      html_url: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok",
    },
    workflow_run: {
      name: "Production Deployment",
      status: "completed",
      conclusion: "success",
      head_branch: "main",
      run_number: 172,
      event: "push",
      actor: { login: "Maijied" },
      html_url:
        "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/actions/runs/0",
      run_started_at: started.toISOString(),
      updated_at: now.toISOString(),
    },
  };
  const event = "workflow_run";
  const summary = buildGithubEventSummary(event, payload);
  const embed = buildGithubWebhookDiscordEmbed({ event, payload, summary });
  const branding = await getMessageBranding(env);

  let res;
  try {
    res = await fetch(config.githubLogWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: branding.discordAuthorName ?? "Lorapok GitHub Log",
        avatar_url: branding.discordAvatarUrl ?? "https://cursor.lorapok.tech/assets/logo.png",
        embeds: [embed],
      }),
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Discord request failed" },
      502
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return jsonResponse(
      { error: text.slice(0, 300) || `Discord returned ${res.status}` },
      502
    );
  }

  return jsonResponse({ ok: true, summary });
}
