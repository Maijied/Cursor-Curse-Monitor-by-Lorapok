import {
  addStoredAdminEmail,
  getMasterEmail,
  listStoredAdminEmails,
  removeStoredAdminEmail,
} from "./_shared/admins.js";
import { jsonResponse, verifyAdminRequest, requirePermission } from "./_shared/auth.js";
import { assignAdminRole, readRbacMap, removeAdminRole, resolveAdminRole } from "./_shared/rbac.js";
import { logAllowlistAdd, logAllowlistRemove } from "./_shared/acl-audit.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const denied = requirePermission(auth, "team.manage");
  if (denied) return denied;

  const emails = await listStoredAdminEmails(env);
  return jsonResponse({ emails, source: env.ADMIN_KV ? "kv" : "env" });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const denied = requirePermission(auth, "team.manage");
  if (denied) return denied;

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

    const normalized = email.trim().toLowerCase();
    if (normalized === getMasterEmail(env)) {
      return jsonResponse({ error: "Cannot modify master admin via API" }, 400);
    }

    const rbacMap = await readRbacMap(env);
    const previousRole = rbacMap[normalized] ?? (await resolveAdminRole(env, normalized, false));

    const emails =
      action === "remove"
        ? await removeStoredAdminEmail(env, normalized)
        : await addStoredAdminEmail(env, normalized);

    const role = String(body.role ?? "admin").trim().toLowerCase();
    if (action === "remove") {
      await removeAdminRole(env, normalized);
      await logAllowlistRemove(env, { actor: auth.email, target: normalized, previousRole });
    } else {
      await assignAdminRole(env, normalized, role);
      await logAllowlistAdd(env, { actor: auth.email, target: normalized, role });
    }

    return jsonResponse({ ok: true, emails, action, role: action === "remove" ? null : role });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
}
