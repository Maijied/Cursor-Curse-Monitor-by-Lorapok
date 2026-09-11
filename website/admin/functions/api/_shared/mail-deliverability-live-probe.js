import { readDiscordConfig } from "./discord-config.js";
import { sendMail } from "./mail.js";
import {
  pollTestmailTag,
  resolveTestmailRuntimeConfig,
  testmailInboxAddress,
} from "./testmail-runtime.js";

const LIVE_PROBE_SOURCES = new Set(["mail-config.product", "mail-config.support"]);
const MAX_LIVE_PROBES = 2;
const POLL_TIMEOUT_MS = 14_000;
const POLL_INTERVAL_MS = 2_000;

/**
 * @param {Array<{ address: string; source: string; ok?: boolean }>} rows
 */
export function selectLiveProbeTargets(rows) {
  const targets = [];
  for (const row of rows) {
    if (!LIVE_PROBE_SOURCES.has(row.source)) continue;
    if (row.ok === false) continue;
    targets.push(row);
    if (targets.length >= MAX_LIVE_PROBES) break;
  }
  return targets;
}

/**
 * @param {string} address
 */
function probeTagForAddress(address) {
  const slug = address.split("@")[0]?.replace(/[^a-z0-9]+/gi, "-") ?? "addr";
  return `mail16-${slug}-${Date.now()}`;
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ address: string }} target
 * @param {{ apiKey: string; namespace: string }} testmail
 */
async function sendLiveProbeMessage(env, target, testmail) {
  const tag = probeTagForAddress(target.address);
  const to = testmailInboxAddress(testmail.namespace, tag);
  const subject = `MAIL-16 deliverability probe — ${target.address}`;
  const text = `Probe from ${target.address} at ${new Date().toISOString()}\ntag:${tag}`;

  const sendResult = await sendMail(env, {
    to,
    subject,
    html: `<p>${text}</p>`,
    text,
    category: "system",
    from: { email: target.address, displayName: "Mission Control Probe" },
    skipMailbox: true,
    skipAudit: true,
    skipSystemLog: true,
  });

  return { tag, to, sendResult };
}

/** @param {{ apiKey: string; namespace: string }} testmail */
function envShimForPoll(testmail) {
  return {
    TESTMAIL_API_KEY: testmail.apiKey,
    TESTMAIL_NAMESPACE: testmail.namespace,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {Record<string, unknown>} env
 * @param {Array<{ address: string; source: string; ok: boolean; checks: Array<{ id: string; ok: boolean; detail: string }> }>} results
 */
export async function runLiveDeliverabilityProbes(env, results) {
  const testmail = resolveTestmailRuntimeConfig(env);
  if (!testmail.ok) {
    return {
      skipped: true,
      reason: "testmail_not_configured",
      probes: [],
    };
  }

  const targets = selectLiveProbeTargets(results);
  if (!targets.length) {
    return { skipped: true, reason: "no_eligible_addresses", probes: [] };
  }

  const startedAt = Date.now();
  const pending = [];

  for (const target of targets) {
    try {
      const { tag, sendResult } = await sendLiveProbeMessage(env, target, testmail);
      pending.push({ address: target.address, tag, sendResult });
    } catch (err) {
      pending.push({
        address: target.address,
        tag: null,
        sendResult: {
          sent: false,
          reason: err instanceof Error ? err.message : "Live probe failed",
        },
      });
    }
  }

  const probes = await waitForAllProbeInboxes(testmail, pending, startedAt);
  return { skipped: false, probes };
}

/**
 * @param {{ apiKey: string; namespace: string }} testmail
 * @param {Array<{ address: string; tag: string | null; sendResult: { sent: boolean; transport?: string; reason?: string } }>} pending
 * @param {number} startedAt
 */
async function waitForAllProbeInboxes(testmail, pending, startedAt) {
  const envShim = envShimForPoll(testmail);
  const deadline = startedAt + POLL_TIMEOUT_MS;

  /** @type {Array<{ address: string; tag?: string; transport?: string; check: { id: string; ok: boolean; detail: string } | null }>} */
  const probes = pending.map((row) => {
    if (!row.sendResult.sent || !row.tag) {
      return {
        address: row.address,
        check: {
          id: "liveSend",
          ok: false,
          detail: row.sendResult.reason ?? "Send failed",
        },
      };
    }
    return {
      address: row.address,
      tag: row.tag,
      transport: row.sendResult.transport,
      check: null,
    };
  });

  const waiting = probes.filter((p) => p.check === null);
  while (waiting.length > 0 && Date.now() < deadline) {
    for (const probe of waiting) {
      if (!probe.tag) continue;
      const poll = await pollTestmailTag(envShim, probe.tag, startedAt - 5_000);
      if (poll.ok && poll.count > 0) {
        probe.check = {
          id: "liveSend",
          ok: true,
          detail: `Received in testmail via ${probe.transport ?? "mail"}`,
        };
      }
    }
    const stillWaiting = waiting.filter((p) => p.check === null);
    waiting.length = 0;
    waiting.push(...stillWaiting);
    if (waiting.length > 0) await sleep(POLL_INTERVAL_MS);
  }

  for (const probe of probes) {
    if (!probe.check) {
      probe.check = {
        id: "liveSend",
        ok: false,
        detail: "No message in testmail within timeout",
      };
    }
  }

  return probes.map(({ address, check }) => ({ address, check }));
}

/**
 * @param {Array<{ address: string; ok: boolean; checks: Array<{ id: string; ok: boolean; detail: string }> }>} results
 * @param {{ skipped?: boolean; probes?: Array<{ address: string; check: { id: string; ok: boolean; detail: string } }> }} live
 */
export function mergeLiveProbeChecks(results, live) {
  if (live.skipped || !live.probes?.length) return results;

  return results.map((row) => {
    const probe = live.probes.find((p) => p.address === row.address);
    if (!probe) return row;
    const checks = [...(row.checks ?? []), probe.check];
    const ok = checks.every((c) => c.ok);
    return { ...row, checks, ok };
  });
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ failed: string[]; lastRunAt: string }} input
 */
export async function notifyDiscordMailDeliverabilityFailure(env, input) {
  const config = await readDiscordConfig(env);
  const webhookUrl = config.deploymentWebhookUrl || config.communityWebhookUrl;
  if (!webhookUrl) {
    return { ok: false, skipped: true, reason: "no_discord_webhook" };
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Mission Control",
      embeds: [
        {
          title: "Mail deliverability audit failed",
          description: `Live/static audit failed for ${input.failed.length} address(es).`,
          color: 0xed4245,
          fields: [
            { name: "Failed", value: input.failed.slice(0, 8).join("\n") || "—", inline: false },
            { name: "Run at", value: input.lastRunAt, inline: true },
          ],
          footer: { text: "MAIL-16 · Mission Control" },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  return res.ok
    ? { ok: true, status: res.status }
    : { ok: false, status: res.status, error: (await res.text().catch(() => "")).slice(0, 200) };
}
