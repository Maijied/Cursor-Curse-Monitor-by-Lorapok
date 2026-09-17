import { readDiscordConfig } from "./discord-config.js";
import { getMessageBranding } from "./message-cards-runtime.js";
import { truncateDiscordText } from "./discord-deploy-context.js";
import { logSystemEvent } from "./system-log.js";
import { readSocialConfig, SOCIAL_PLATFORMS, validateSocialPlatform } from "./social-config.js";
import { sendSocialPost } from "./social-notify.js";

const COLORS = {
  push: 0x5865f2,
  release: 0x57f287,
  workflow_success: 0x57f287,
  workflow_failure: 0xed4245,
  workflow_cancelled: 0x95a5a6,
  workflow_other: 0xfee75c,
  default: 0x4d9fff,
};

const REPO_URL = "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok";

/**
 * Workflow runs fire many intermediate statuses. Only post when the run finished.
 * @param {Record<string, unknown>} payload
 */
export function shouldFanOutWorkflowRun(payload) {
  const run = payload?.workflow_run;
  if (!run || typeof run !== "object") return false;
  const status = String(run.status ?? "");
  const conclusion = run.conclusion != null ? String(run.conclusion) : "";
  if (status === "completed" && conclusion) return true;
  // Some deliveries omit status but include a terminal conclusion
  return ["success", "failure", "cancelled", "timed_out", "action_required", "neutral", "skipped"].includes(
    conclusion
  );
}

/**
 * @param {{ event: string; payload: Record<string, unknown> }} input
 */
export function shouldFanOutGithubDiscord(input) {
  const event = String(input.event ?? "");
  if (event === "workflow_run") return shouldFanOutWorkflowRun(input.payload ?? {});
  return event === "push" || event === "release";
}

/**
 * Build a human summary for Discord / ingest logs.
 * @param {string} event
 * @param {Record<string, unknown>} payload
 */
export function buildGithubEventSummary(event, payload) {
  const p = payload ?? {};
  if (event === "release") {
    const tag = p.release?.tag_name ? String(p.release.tag_name) : "release";
    const action = p.action ? String(p.action) : "published";
    const name = p.release?.name ? String(p.release.name) : "";
    return name && name !== tag ? `${tag} · ${name} (${action})` : `${tag} (${action})`;
  }
  if (event === "workflow_run") {
    const run = p.workflow_run ?? {};
    const name = String(run.name ?? "Workflow");
    const conclusion = String(run.conclusion ?? run.status ?? "unknown");
    const branch = run.head_branch ? String(run.head_branch) : "";
    const actor = run.actor?.login || p.sender?.login || "";
    const runNumber = run.run_number != null ? `#${run.run_number}` : "";
    const parts = [name, runNumber, conclusion].filter(Boolean);
    let line = parts.join(" · ");
    if (branch) line += ` on \`${branch}\``;
    if (actor) line += ` by @${actor}`;
    return line;
  }
  if (event === "push") {
    const ref = String(p.ref ?? "").replace(/^refs\/heads\//, "").replace(/^refs\/tags\//, "tag:");
    const pusher = p.pusher?.name || p.sender?.login || "";
    const count = Array.isArray(p.commits) ? p.commits.length : 0;
    const head = p.head_commit?.message
      ? String(p.head_commit.message).split("\n")[0]
      : "";
    let line = ref ? `push → ${ref}` : "push";
    if (count) line += ` · ${count} commit${count === 1 ? "" : "s"}`;
    if (pusher) line += ` by @${pusher}`;
    if (head) line += ` — ${truncateDiscordText(head, 80)}`;
    return line;
  }
  return "GitHub event";
}

/**
 * @param {string | null | undefined} startedAt
 * @param {string | null | undefined} updatedAt
 */
function formatDuration(startedAt, updatedAt) {
  if (!startedAt || !updatedAt) return null;
  const start = Date.parse(String(startedAt));
  const end = Date.parse(String(updatedAt));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const sec = Math.round((end - start) / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * @param {{ event: string; payload: Record<string, unknown>; summary: string }} input
 */
export function buildGithubWebhookSocialText(input) {
  const event = String(input.event ?? "");
  const summary = String(input.summary ?? buildGithubEventSummary(event, input.payload));
  const repo = String(input.payload?.repository?.full_name ?? "Maijied/Cursor-Curse-Monitor-by-Lorapok");
  const lines = [`⚡ ${repo}`, "", summary];

  if (event === "release" && input.payload?.release?.html_url) {
    lines.push(String(input.payload.release.html_url));
  } else if (event === "workflow_run" && input.payload?.workflow_run?.html_url) {
    lines.push(String(input.payload.workflow_run.html_url));
  } else {
    lines.push(REPO_URL);
  }

  lines.push("#CursorIDE #OpenSource #LorapokLabs");
  return truncateDiscordText(lines.join("\n"), 500);
}

/**
 * Professional Discord embed for the github-log channel (not community / deployment).
 * @param {{ event: string; payload: Record<string, unknown>; summary: string }} input
 */
export function buildGithubWebhookDiscordEmbed(input) {
  const event = String(input.event ?? "unknown");
  const payload = input.payload ?? {};
  const summary = String(input.summary ?? buildGithubEventSummary(event, payload));
  const repo = String(payload.repository?.full_name ?? "repository");
  const url =
    payload.release?.html_url ??
    payload.workflow_run?.html_url ??
    payload.compare ??
    payload.repository?.html_url ??
    REPO_URL;

  let title = "GitHub activity";
  let color = COLORS.default;
  /** @type {Array<{ name: string; value: string; inline?: boolean }>} */
  const fields = [{ name: "Repository", value: `[${repo}](${REPO_URL})`, inline: true }];

  if (event === "push") {
    title = "Push";
    color = COLORS.push;
    const ref = String(payload.ref ?? "").replace(/^refs\/heads\//, "");
    const pusher = payload.pusher?.name || payload.sender?.login;
    const count = Array.isArray(payload.commits) ? payload.commits.length : 0;
    if (ref) fields.push({ name: "Branch", value: `\`${ref}\``, inline: true });
    if (pusher) fields.push({ name: "Author", value: `@${pusher}`, inline: true });
    if (count) fields.push({ name: "Commits", value: String(count), inline: true });
    fields.push({ name: "Summary", value: truncateDiscordText(summary, 240), inline: false });
  } else if (event === "release") {
    title = "Release";
    color = COLORS.release;
    const tag = payload.release?.tag_name ? String(payload.release.tag_name) : "";
    const action = payload.action ? String(payload.action) : "";
    if (tag) fields.push({ name: "Tag", value: `\`${tag}\``, inline: true });
    if (action) fields.push({ name: "Action", value: action, inline: true });
    fields.push({ name: "Summary", value: truncateDiscordText(summary, 240), inline: false });
  } else if (event === "workflow_run") {
    const run = payload.workflow_run ?? {};
    const conclusion = String(run.conclusion ?? run.status ?? "");
    const name = String(run.name ?? "Workflow");
    if (conclusion === "success") {
      title = `Workflow succeeded · ${name}`;
      color = COLORS.workflow_success;
    } else if (conclusion === "failure") {
      title = `Workflow failed · ${name}`;
      color = COLORS.workflow_failure;
    } else if (conclusion === "cancelled") {
      title = `Workflow cancelled · ${name}`;
      color = COLORS.workflow_cancelled;
    } else {
      title = `Workflow · ${name}`;
      color = COLORS.workflow_other;
    }
    fields.push({ name: "Result", value: conclusion || "unknown", inline: true });
    if (run.head_branch) {
      fields.push({ name: "Branch", value: `\`${String(run.head_branch)}\``, inline: true });
    }
    if (run.run_number != null) {
      fields.push({ name: "Run", value: `#${run.run_number}`, inline: true });
    }
    const actor = run.actor?.login || payload.sender?.login;
    if (actor) fields.push({ name: "Triggered by", value: `@${actor}`, inline: true });
    const eventName = run.event ? String(run.event) : "";
    if (eventName) fields.push({ name: "Trigger", value: eventName, inline: true });
    const duration = formatDuration(run.run_started_at, run.updated_at);
    if (duration) fields.push({ name: "Duration", value: duration, inline: true });
    fields.push({ name: "Summary", value: truncateDiscordText(summary, 240), inline: false });
  } else {
    fields.push({ name: "Event", value: event, inline: true });
    fields.push({ name: "Summary", value: truncateDiscordText(summary, 240), inline: false });
  }

  return {
    title,
    color,
    url: String(url),
    description: truncateDiscordText(summary, 180),
    fields,
    footer: { text: "github-log · Mission Control" },
    timestamp: new Date().toISOString(),
  };
}

/**
 * GitHub ingest → Discord **github-log** channel only.
 * Never posts to community (announcements) or deployment (rich deploy cards).
 * @param {Record<string, unknown>} env
 * @param {{ event: string; payload: Record<string, unknown>; summary: string }} input
 */
export async function notifyDiscordGithubWebhook(env, input) {
  if (!shouldFanOutGithubDiscord(input)) {
    return { ok: true, skipped: true, reason: "event_filtered", target: "github_log" };
  }

  const config = await readDiscordConfig(env);
  const webhookUrl = config.githubLogWebhookUrl;
  if (!webhookUrl) {
    return { ok: false, skipped: true, reason: "no_github_log_webhook", target: "github_log" };
  }

  const embed = buildGithubWebhookDiscordEmbed(input);
  const branding = await getMessageBranding(env);

  let res;
  try {
    res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: branding.discordAuthorName ?? "Lorapok GitHub Log",
        avatar_url: branding.discordAvatarUrl ?? "https://cursor.lorapok.tech/assets/logo.png",
        embeds: [embed],
      }),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      target: "github_log",
      error: error instanceof Error ? error.message : "Discord request failed",
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      target: "github_log",
      error: text.slice(0, 300) || `Discord returned ${res.status}`,
    };
  }

  return { ok: true, status: res.status, target: "github_log" };
}

/**
 * Social fan-out: release events only (avoid spam on every push/workflow).
 *
 * @param {Record<string, unknown>} env
 * @param {{ event: string; payload: Record<string, unknown>; summary: string }} input
 */
export async function fanOutGithubWebhookSocial(env, input) {
  if (String(input.event ?? "") !== "release") {
    return { ok: true, skipped: true, reason: "social_release_only", results: [] };
  }

  const config = await readSocialConfig(env);
  const text = buildGithubWebhookSocialText(input);
  const results = [];

  for (const platform of SOCIAL_PLATFORMS) {
    const platformConfig = config[platform] ?? {};
    const validation = validateSocialPlatform(platform, platformConfig);
    if (!validation.ok || !validation.enabled) {
      results.push({
        ok: false,
        platform,
        skipped: true,
        error: validation.enabled === false ? "Disabled" : validation.error ?? "Not configured",
      });
      continue;
    }
    results.push(await sendSocialPost(platform, platformConfig, text));
  }

  const failed = results.filter((r) => !r.ok && !r.skipped).length;
  return { ok: failed === 0, results };
}

/**
 * Fan out GitHub webhook ingest to Discord github-log + social (best-effort).
 *
 * @param {Record<string, unknown>} env
 * @param {{ event: string; payload: Record<string, unknown>; summary: string }} input
 */
export async function fanOutGithubWebhook(env, input) {
  const discord = await notifyDiscordGithubWebhook(env, input);
  const social = await fanOutGithubWebhookSocial(env, input);

  const level = discord.ok || discord.skipped ? (social.ok || social.skipped ? "info" : "warn") : "error";
  await logSystemEvent(env, {
    level,
    source: "github-webhook-fanout",
    message: `GitHub ${input.event} fan-out: discord=${discord.ok ? "ok" : discord.skipped ? "skip" : "fail"} social=${social.skipped ? "skip" : social.ok ? "ok" : "partial"}`,
    meta: {
      event: input.event,
      discord,
      socialSummary: social.results?.length ?? 0,
    },
  });

  return { discord, social };
}
