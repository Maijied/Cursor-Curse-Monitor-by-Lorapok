import { jsonResponse, verifyAdminRequest } from "../_shared/auth.js";
import { logAuthenticatedRequest } from "../_shared/activity-log.js";
import { broadcastToSubscribers } from "../_shared/subscriber-broadcast.js";

export async function onRequestPost(context) {
  const startedAt = Date.now();
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    const response = jsonResponse({ error: "Invalid JSON" }, 400);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  const result = await broadcastToSubscribers(env, {
    title: body.title,
    message: body.message ?? body.shortMessage,
    severity: body.severity,
    feedbackUrl: body.feedbackUrl ?? body.feedback_url,
    sentBy: auth.email,
  });

  const status = result.error ? 400 : result.failed > 0 ? 207 : 200;
  const response = jsonResponse(result, status);
  return logAuthenticatedRequest(context, auth, response, startedAt);
}
