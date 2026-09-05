import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { logAuthenticatedRequest } from "../../_shared/activity-log.js";
import { pollTestmailTag, resolveTestmailRuntimeConfig } from "../../_shared/testmail-runtime.js";

/** Poll testmail.app inbox for a tag (used by Mailbox E2E probe UI). */
export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const tag = String(url.searchParams.get("tag") ?? "").trim();
  if (!tag) {
    const response = jsonResponse({ error: "tag query parameter is required" }, 400);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  const config = resolveTestmailRuntimeConfig(env);
  if (!config.ok) {
    const response = jsonResponse({ ok: false, error: config.error }, 503);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  const timestampFrom = Number.parseInt(url.searchParams.get("since") ?? "0", 10) || undefined;

  try {
    const polled = await pollTestmailTag(env, tag, timestampFrom);
    const first = polled.emails?.[0] ?? null;
    const response = jsonResponse({
      ok: true,
      tag,
      inbox: `${config.namespace}.${tag}@inbox.testmail.app`,
      count: polled.count ?? 0,
      received: Boolean(first),
      email: first
        ? {
            from: first.from ?? null,
            subject: first.subject ?? null,
            preview: String(first.text ?? first.html ?? "")
              .replace(/\s+/g, " ")
              .slice(0, 200),
          }
        : null,
    });
    return logAuthenticatedRequest(context, auth, response, startedAt);
  } catch (err) {
    console.error("testmail poll error", err);
    const response = jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : "testmail poll failed" },
      502
    );
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }
}
