/**
 * testmail.app helpers for subscribe / welcome-mail E2E probes.
 * Docs: https://testmail.app/docs/
 */
import { envWithCursorCloudflareSecrets } from "./cred-vault-sync.mjs";

const API_BASE = "https://api.testmail.app/api/json";

export function resolveTestmailConfig(env = process.env) {
  const merged = envWithCursorCloudflareSecrets(env);
  const apiKey = String(merged.TESTMAIL_API_KEY ?? "").trim();
  const namespace = String(merged.TESTMAIL_NAMESPACE ?? "").trim();
  if (!apiKey || !namespace) {
    throw new Error(
      "TESTMAIL_API_KEY and TESTMAIL_NAMESPACE are required.\n" +
        "  Store in cred vault: node website/admin/scripts/sync-testmail-cred-vault.mjs\n" +
        "  Or export env vars (see docs/guides/CLOUDFLARE_EMAIL_AND_ROUTING.md §8)"
    );
  }
  return { apiKey, namespace };
}

/** @param {string} namespace @param {string} tag */
export function testmailAddress(namespace, tag) {
  const safeTag = String(tag).trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${namespace}.${safeTag}@inbox.testmail.app`;
}

/**
 * @param {{ apiKey: string; namespace: string; tag?: string; tagPrefix?: string; livequery?: boolean; timestampFrom?: number; limit?: number }} opts
 */
export async function fetchTestmailInbox(opts) {
  const params = new URLSearchParams({
    apikey: opts.apiKey,
    namespace: opts.namespace,
    pretty: "true",
    limit: String(opts.limit ?? 10),
  });
  if (opts.tag) params.set("tag", opts.tag);
  if (opts.tagPrefix) params.set("tag_prefix", opts.tagPrefix);
  if (opts.livequery) params.set("livequery", "true");
  if (opts.timestampFrom) params.set("timestamp_from", String(opts.timestampFrom));

  let url = `${API_BASE}?${params}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { redirect: "follow" });
    if (res.status === 307 && res.headers.get("location")) {
      url = res.headers.get("location");
      continue;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`testmail API ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
    }
    return body;
  }
  throw new Error("testmail API: too many redirects");
}

/**
 * Poll until an email with the given tag arrives (or timeout).
 * @param {{ apiKey: string; namespace: string; tag: string; timeoutMs?: number; intervalMs?: number }} opts
 */
export async function waitForTestmailTag(opts) {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 3_000;
  const started = Date.now();
  const timestampFrom = Date.now() - 5_000;

  while (Date.now() - started < timeoutMs) {
    const inbox = await fetchTestmailInbox({
      apiKey: opts.apiKey,
      namespace: opts.namespace,
      tag: opts.tag,
      timestampFrom,
      livequery: true,
    });
    const emails = Array.isArray(inbox?.emails) ? inbox.emails : [];
    if (emails.length > 0) return emails[0];
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}
