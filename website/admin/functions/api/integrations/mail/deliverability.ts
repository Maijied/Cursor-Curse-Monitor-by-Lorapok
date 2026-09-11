import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import {
  readMailDeliverabilityState,
  runMailDeliverabilityAudit,
} from "../../_shared/mail-deliverability-audit.js";

/**
 * Returns the mail deliverability audit matrix (MAIL-16).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "integrations.read");
  if (readDenied) return readDenied;

  const status = await readMailDeliverabilityState(env);
  return jsonResponse({ ok: true, status });
}

/**
 * Runs a fresh deliverability audit on demand.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "integrations.write");
  if (denied) return denied;

  const status = await runMailDeliverabilityAudit(env);
  return jsonResponse({ ok: true, status });
}
