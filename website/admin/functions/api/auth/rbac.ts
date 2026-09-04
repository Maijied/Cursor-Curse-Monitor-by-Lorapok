import { verifyAdminRequest, jsonResponse, requirePermission } from "../_shared/auth.js";
import {
  assignAdminRole,
  buildRbacTeamSnapshot,
  readRbacMap,
  removeAdminRole,
  resolveAdminRole,
  ROLES,
} from "../_shared/rbac.js";
import { logRoleAssignment, logRoleClear } from "../_shared/acl-audit.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const denied = requirePermission(auth, "team.manage");
  if (denied) return denied;

  const snapshot = await buildRbacTeamSnapshot(env);
  return jsonResponse({ ok: true, ...snapshot });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const denied = requirePermission(auth, "team.manage");
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return jsonResponse({ error: "email is required" }, 400);
  }

  if (!env.ADMIN_KV?.put) {
    return jsonResponse({ error: "ADMIN_KV binding not configured" }, 503);
  }

  try {
    const rbacMap = await readRbacMap(env);
    const previousExplicit = rbacMap[email] ?? null;
    const previousEffective = await resolveAdminRole(env, email, false);

    if (body.clear === true) {
      const result = await removeAdminRole(env, email);
      await logRoleClear(env, {
        actor: auth.email,
        target: email,
        previousRole: previousExplicit ?? previousEffective,
      });
      const snapshot = await buildRbacTeamSnapshot(env);
      return jsonResponse({ ok: true, ...result, ...snapshot });
    }

    const role = String(body?.role ?? "").trim().toLowerCase();
    if (!role || !ROLES.includes(role) || role === "master") {
      return jsonResponse(
        { error: `role must be one of: ${ROLES.filter((r) => r !== "master").join(", ")}` },
        400
      );
    }

    const result = await assignAdminRole(env, email, role);
    await logRoleAssignment(env, {
      actor: auth.email,
      target: email,
      role,
      previousRole: previousExplicit ?? (previousEffective !== role ? previousEffective : null),
    });
    const snapshot = await buildRbacTeamSnapshot(env);
    return jsonResponse({ ok: true, ...result, ...snapshot });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
}
