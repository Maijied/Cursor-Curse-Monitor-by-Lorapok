import { jsonResponse, verifyAdminRequest, requirePermission } from "./_shared/auth.js";
import { logAuthenticatedRequest } from "./_shared/activity-log.js";
import { dispatchRollbackWorkflow } from "./_shared/deploy-workflow.js";

/**
 * Handles an authenticated master-admin request to trigger a rollback workflow.
 *
 * @param context - Request context containing the request, environment, and workflow metadata
 * @returns The authenticated response for the rollback request
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
    const response = await dispatchRollbackWorkflow(env, body, "Rollback triggered", {
      triggeredBy: auth.email,
    }, context);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  } catch (err) {
    console.error("Rollback handler error", err);
    const status = err instanceof SyntaxError ? 400 : 500;
    const message = status === 400 ? "Invalid JSON body" : "Server error";
    const response = jsonResponse({ error: message }, status);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }
}
