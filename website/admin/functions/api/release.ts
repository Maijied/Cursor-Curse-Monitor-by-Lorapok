import { jsonResponse, verifyAdminRequest, requirePermission } from "./_shared/auth.js";
import { logAuthenticatedRequest } from "./_shared/activity-log.js";
import { dispatchReleaseWorkflow } from "./_shared/deploy-workflow.js";

/**
 * Handles authenticated POST requests to trigger the release workflow.
 *
 * @param context - The request context containing the request and environment.
 */
export async function onRequestPost(context) {
  const startedAt = Date.now();
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "deploy.run");
  if (denied) return denied;

  try {
    const body = await request.json();
    const response = await dispatchReleaseWorkflow(env, body, "Release workflow triggered successfully", {
      triggeredBy: auth.email,
    }, context);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  } catch (err) {
    console.error("Release handler error", err);
    const status = err instanceof SyntaxError ? 400 : 500;
    const message = status === 400 ? "Invalid JSON body" : "Server error";
    const response = jsonResponse({ error: message }, status);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }
}
