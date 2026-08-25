import { jsonResponse, verifyAdminRequest, requireMasterAdmin } from "./_shared/auth.js";
import { logAuthenticatedRequest } from "./_shared/activity-log.js";
import { dispatchReleaseWorkflow } from "./_shared/deploy-workflow.js";

export async function onRequestPost(context) {
  const startedAt = Date.now();
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const masterOnly = requireMasterAdmin(auth);
  if (masterOnly) return masterOnly;

  try {
    const body = await request.json();
    const response = await dispatchReleaseWorkflow(env, body, "Release workflow triggered successfully");
    return logAuthenticatedRequest(context, auth, response, startedAt);
  } catch (err) {
    console.error("Release handler error", err);
    const status = err instanceof SyntaxError ? 400 : 500;
    const message = status === 400 ? "Invalid JSON body" : "Server error";
    const response = jsonResponse({ error: message }, status);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }
}
