import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { readDiscordConfig } from "../../_shared/discord-config.js";
import { notifyDiscordDeployment } from "../../_shared/discord-notify.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  if (!auth.isMaster) {
    return jsonResponse({ error: "Master admin only" }, 403);
  }

  const config = await readDiscordConfig(env);
  if (!config.webhookUrl) {
    return jsonResponse({ error: "Discord webhook URL is not configured" }, 400);
  }

  const result = await notifyDiscordDeployment(env, {
    phase: "test",
    actionType: "test",
    triggeredBy: auth.email,
    summary: "This is a test message from Lorapok Mission Control. Deployment notifications are wired up correctly.",
    runUrl: env.ADMIN_PUBLIC_URL ?? "https://cursor-dev.lorapok.tech",
  });

  if (!result.ok && !result.skipped) {
    return jsonResponse({ error: result.error ?? "Discord webhook failed", status: result.status }, 502);
  }
  if (result.skipped) {
    return jsonResponse({ error: "Discord notifications are disabled in settings" }, 400);
  }

  return jsonResponse({ ok: true, message: "Test message sent to Discord." });
}
