import { jsonResponse, verifyAdminRequest, requirePermission } from "./_shared/auth.js";
import { logAuthenticatedRequest } from "./_shared/activity-log.js";
import { dispatchPublishWorkflow } from "./_shared/deploy-workflow.js";
import { fetchSiteData, liveTagFromSiteData } from "./_shared/site-data.js";

/**
 * Handles an authenticated master-admin request to trigger a deployment.
 *
 * @param context - The request context containing the request and environment.
 * @returns The authentication, authorization, deployment, or error response.
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
    let rollbackSourceTag = null;
    try {
      rollbackSourceTag = liveTagFromSiteData(await fetchSiteData(env));
    } catch {
      /* optional */
    }
    const response = await dispatchPublishWorkflow(env, body, "Deployment triggered successfully", {
      triggeredBy: auth.email,
      rollbackSourceTag,
    }, context);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  } catch (err) {
    console.error("Deploy handler error", err);
    const status = err instanceof SyntaxError ? 400 : 500;
    const message = status === 400 ? "Invalid JSON body" : "Server error";
    const response = jsonResponse({ error: message }, status);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }
}
