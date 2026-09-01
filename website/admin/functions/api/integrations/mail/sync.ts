import { jsonResponse, verifyAdminRequest, requireMasterAdmin } from "../../_shared/auth.js";
import { logAuthenticatedRequest } from "../../_shared/activity-log.js";
import { syncUpMailTransport } from "../../_shared/mail-sync.js";

/** Master admin: dispatch deploy-infra to repair outbound mail (relay + REST + Pages deploy). */
export async function onRequestPost(context) {
  const startedAt = Date.now();
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const masterOnly = requireMasterAdmin(auth);
  if (masterOnly) return masterOnly;

  try {
    const result = await syncUpMailTransport(env, context, auth.email);
    const status = result.ok ? 200 : result.code === "missing_github_token" ? 500 : 502;
    const response = jsonResponse(result, status);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  } catch (err) {
    console.error("mail sync handler error", err);
    const response = jsonResponse({ error: "Mail sync failed" }, 500);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }
}
