import { jsonResponse, verifyAdminRequest, requirePermission } from "./_shared/auth.js";
import { readSubscribers, subscriberStats } from "./_shared/subscribers.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "subscribers.write");
  if (denied) return denied;

  try {
    const items = await readSubscribers(env.ADMIN_KV);
    return jsonResponse({
      items,
      stats: subscriberStats(items),
    });
  } catch (err) {
    console.error("subscribers GET", err);
    return jsonResponse({ error: "Failed to load subscribers" }, 500);
  }
}
