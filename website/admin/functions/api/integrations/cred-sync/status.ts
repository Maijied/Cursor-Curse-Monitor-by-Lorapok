import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { buildCredSyncHealth } from "../../_shared/cred-sync-audit.js";

/**
 * Returns cred vault GitHub sync health — drift detection and recent audit attempts.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "integrations.read");
  if (readDenied) return readDenied;

  const status = await buildCredSyncHealth(env);
  return jsonResponse({ ok: true, status });
}
