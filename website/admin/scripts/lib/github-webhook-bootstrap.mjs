import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

export const DEFAULT_GITHUB_WEBHOOK_EVENTS = ["push", "release", "workflow_run"];

/**
 * @param {number} [bytes]
 */
export function generateWebhookSecret(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

/**
 * @param {string} repo
 */
function ghApiJson(repo, endpoint, method = "GET", body = null) {
  const args = ["api", `repos/${repo}/hooks${endpoint}`, "-X", method];
  if (body) {
    args.push("--input", "-");
  }
  const res = spawnSync("gh", args, {
    encoding: "utf8",
    input: body ? JSON.stringify(body) : undefined,
  });
  if (res.status !== 0) {
    const detail = (res.stderr || res.stdout || "").trim();
    throw new Error(detail || `gh api failed (${res.status})`);
  }
  const text = (res.stdout || "").trim();
  return text ? JSON.parse(text) : null;
}

/**
 * @param {string} repo
 * @param {string} hookUrl
 */
export function findGithubRepoWebhookId(repo, hookUrl) {
  const res = spawnSync("gh", ["api", `repos/${repo}/hooks`], { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error((res.stderr || res.stdout || "gh api hooks list failed").trim());
  }
  const hooks = JSON.parse(res.stdout || "[]");
  if (!Array.isArray(hooks)) return null;
  const match = hooks.find((hook) => String(hook?.config?.url ?? "") === hookUrl);
  return match?.id ?? null;
}

/**
 * @param {string} adminUrl
 * @param {string} idToken
 * @param {{ repository: string; webhookSecret: string; webhookEvents?: string[]; secretsEnvironment?: string }} input
 */
export async function saveGithubWebhookConfig(adminUrl, idToken, input) {
  const base = adminUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/api/integrations/github/config`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repository: input.repository,
      secretsEnvironment: input.secretsEnvironment ?? "admin-production",
      webhookSecret: input.webhookSecret,
      webhookEvents: input.webhookEvents ?? DEFAULT_GITHUB_WEBHOOK_EVENTS,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Save GitHub config failed (${res.status})`);
  }
  return data;
}

/**
 * @param {{ repository: string; hookUrl: string; webhookSecret: string; webhookEvents?: string[] }} input
 */
export function ensureGithubRepoWebhook(input) {
  const events = input.webhookEvents ?? DEFAULT_GITHUB_WEBHOOK_EVENTS;
  const payload = {
    config: {
      url: input.hookUrl,
      content_type: "json",
      secret: input.webhookSecret,
      insecure_ssl: "0",
    },
    events,
    active: true,
  };

  const existingId = findGithubRepoWebhookId(input.repository, input.hookUrl);
  if (existingId) {
    ghApiJson(input.repository, `/${existingId}`, "PATCH", payload);
    return { action: "updated", hookId: existingId };
  }

  const created = ghApiJson(input.repository, "", "POST", payload);
  return { action: "created", hookId: created?.id ?? null };
}
