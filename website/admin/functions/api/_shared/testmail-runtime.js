/**
 * testmail.app helpers for Pages Functions (no Node cred vault).
 * Docs: https://testmail.app/docs/
 */

const API_BASE = "https://api.testmail.app/api/json";

/**
 * @param {Record<string, unknown>} env
 */
export function resolveTestmailRuntimeConfig(env) {
  const apiKey = String(env?.TESTMAIL_API_KEY ?? "").trim();
  const namespace = String(env?.TESTMAIL_NAMESPACE ?? "").trim();
  if (!apiKey || !namespace) {
    return {
      ok: false,
      error:
        "TESTMAIL_API_KEY and TESTMAIL_NAMESPACE are required on Mission Control. " +
        "Run: node website/admin/scripts/setup-testmail-pages-secret.mjs",
    };
  }
  return { ok: true, apiKey, namespace };
}

/** @param {string} namespace @param {string} tag */
export function testmailInboxAddress(namespace, tag) {
  const safeTag = String(tag).trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${namespace}.${safeTag}@inbox.testmail.app`;
}

/**
 * @param {{ apiKey: string; namespace: string; tag: string; timestampFrom?: number; limit?: number }} opts
 */
export async function fetchTestmailInbox(opts) {
  const params = new URLSearchParams({
    apikey: opts.apiKey,
    namespace: opts.namespace,
    tag: opts.tag,
    pretty: "true",
    livequery: "true",
    limit: String(opts.limit ?? 5),
  });
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
    if (body?.result && body.result !== "success") {
      throw new Error(`testmail API error: ${String(body.result)}`);
    }
    return body;
  }
  throw new Error("testmail API: too many redirects");
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} tag
 * @param {number} [timestampFrom]
 */
export async function pollTestmailTag(env, tag, timestampFrom) {
  const config = resolveTestmailRuntimeConfig(env);
  if (!config.ok) return { ok: false, error: config.error, emails: [] };

  const inbox = await fetchTestmailInbox({
    apiKey: config.apiKey,
    namespace: config.namespace,
    tag,
    timestampFrom,
  });
  const emails = Array.isArray(inbox?.emails) ? inbox.emails : [];
  return { ok: true, emails, count: emails.length };
}
