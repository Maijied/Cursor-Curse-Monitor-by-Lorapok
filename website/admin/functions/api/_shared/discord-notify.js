import { logSystemEvent } from "./system-log.js";
import { readDiscordConfig } from "./discord-config.js";

const COLORS = {
  started: 0x5865f2,
  success: 0x57f287,
  failure: 0xed4245,
  cancelled: 0xfee75c,
};

const ACTION_LABELS = {
  "full-release": "Full release",
  "publish-tag": "Publish tag",
  rollback: "Rollback",
  "deploy-infra": "Infra deploy",
};

function formatActionType(actionType) {
  if (!actionType) return "Deployment";
  const raw = String(actionType);
  const key = raw.split(" - ")[0]?.trim().toLowerCase() ?? raw.toLowerCase();
  if (ACTION_LABELS[key]) return ACTION_LABELS[key];
  if (raw.includes("full-release")) return ACTION_LABELS["full-release"];
  if (raw.includes("publish-tag")) return ACTION_LABELS["publish-tag"];
  if (raw.includes("rollback")) return ACTION_LABELS.rollback;
  if (raw.includes("deploy-infra")) return ACTION_LABELS["deploy-infra"];
  return raw.split(" - ")[0] ?? raw;
}

function jobIcon(job) {
  const conclusion = job.conclusion ?? job.status;
  if (conclusion === "success") return "✅";
  if (conclusion === "skipped") return "⏭️";
  if (conclusion === "cancelled") return "⏹️";
  if (conclusion === "failure") return "❌";
  return "⏳";
}

/**
 * @param {Record<string, unknown>} payload
 */
export function buildDeploymentEmbed(payload) {
  const phase = String(payload.phase ?? "completed");
  const conclusion = payload.conclusion ? String(payload.conclusion) : null;
  const actionLabel = formatActionType(payload.actionType);

  let title;
  let color;
  if (phase === "started") {
    title = "🚀 Deployment started";
    color = COLORS.started;
  } else if (conclusion === "success") {
    title = "✅ Deployment succeeded";
    color = COLORS.success;
  } else if (conclusion === "cancelled") {
    title = "⏹️ Deployment cancelled";
    color = COLORS.cancelled;
  } else {
    title = "❌ Deployment failed";
    color = COLORS.failure;
  }

  /** @type {Array<{ name: string; value: string; inline?: boolean }>} */
  const fields = [{ name: "Action", value: actionLabel, inline: true }];

  const version = payload.tag ?? payload.version;
  if (version) fields.push({ name: "Version", value: `\`${version}\``, inline: true });
  if (payload.channel) fields.push({ name: "Channel", value: String(payload.channel), inline: true });
  if (payload.market) fields.push({ name: "Marketplaces", value: String(payload.market), inline: true });
  if (payload.triggeredBy) fields.push({ name: "Triggered by", value: String(payload.triggeredBy), inline: true });

  if (Array.isArray(payload.jobs) && payload.jobs.length > 0) {
    const lines = payload.jobs
      .map((job) => {
        const name = job.name ?? "Job";
        const state = job.conclusion ?? job.status ?? "unknown";
        return `${jobIcon(job)} **${name}** — ${state}`;
      })
      .join("\n");
    fields.push({ name: "Pipeline", value: lines.slice(0, 1024), inline: false });
  }

  /** @type {Record<string, unknown>} */
  const embed = {
    title,
    color,
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: "Lorapok Mission Control" },
  };

  if (payload.summary) embed.description = String(payload.summary).slice(0, 4096);
  if (payload.runUrl) embed.url = String(payload.runUrl);

  return embed;
}

/**
 * @param {string} webhookUrl
 * @param {Record<string, unknown>} payload
 */
export async function sendDiscordWebhook(webhookUrl, payload) {
  const embed = buildDeploymentEmbed(payload);
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Mission Control",
      avatar_url: "https://cursor.lorapok.tech/assets/marketing/icon-128.png",
      embeds: [embed],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: text.slice(0, 300) || `Discord webhook returned ${res.status}`,
    };
  }

  return { ok: true, status: res.status };
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} payload
 */
export async function notifyDiscordDeployment(env, payload) {
  const config = await readDiscordConfig(env);
  if (!config.webhookUrl) {
    return { ok: false, skipped: true, reason: "no_webhook" };
  }

  const result = await sendDiscordWebhook(config.webhookUrl, payload);

  await logSystemEvent(env, {
    source: "discord",
    level: result.ok ? "info" : "error",
    message: result.ok
      ? `Discord ${payload.phase ?? "deployment"} notification sent`
      : `Discord notification failed: ${result.error}`,
    meta: { phase: payload.phase, actionType: payload.actionType, conclusion: payload.conclusion ?? null },
    email: payload.triggeredBy ? String(payload.triggeredBy) : null,
  });

  return result;
}
