import {
  addStoredAdminEmail,
  isMasterEmail,
  listStoredAdminEmails,
  removeStoredAdminEmail,
} from "../_shared/admins.js";
import { jsonResponse, verifyAdminRequest } from "../_shared/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  if (!isMasterEmail(env, auth.email)) {
    return jsonResponse({ error: "Only the master admin can list API admins" }, 403);
  }

  const emails = await listStoredAdminEmails(env);
  return jsonResponse({ emails, source: env.ADMIN_KV ? "kv" : "env" });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  if (!isMasterEmail(env, auth.email)) {
    return jsonResponse({ error: "Only the master admin can modify API admins" }, 403);
  }

  try {
    const body = await request.json();
    const email = body.email;
    const action = body.action ?? "add";

    if (!email || typeof email !== "string") {
      return jsonResponse({ error: "email is required" }, 400);
    }

    if (!env.ADMIN_KV?.put) {
      return jsonResponse(
        {
          error: "ADMIN_KV binding not configured. Add invited emails to ADMIN_EMAILS env var.",
          hint: "Set ADMIN_EMAILS=colleague@example.com in Cloudflare Pages settings",
        },
        503
      );
    }

    const emails =
      action === "remove"
        ? await removeStoredAdminEmail(env, email)
        : await addStoredAdminEmail(env, email);

    return jsonResponse({ ok: true, emails, action });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
}
