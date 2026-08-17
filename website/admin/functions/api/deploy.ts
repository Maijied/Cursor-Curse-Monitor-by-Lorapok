import { jsonResponse, verifyAdminRequest } from "./_shared/auth.js";
import { logAuthenticatedRequest } from "./_shared/activity-log.js";
import { dispatchDeploymentWorkflow } from "./_shared/deploy-workflow.js";

export async function onRequestPost(context) {
  const startedAt = Date.now();
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const response = await dispatchDeploymentWorkflow(env, body, "Deployment triggered successfully");
    return logAuthenticatedRequest(context, auth, response, startedAt);
  } catch (err) {
    console.error("Deploy handler error", err);
    const response = jsonResponse({ error: "Server error" }, 500);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }
}
