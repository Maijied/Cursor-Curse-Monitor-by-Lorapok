import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { syncEmailIdentities } from "../../_shared/email-identities-sync.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "mail.provision");
  if (denied) return denied;

  let body = {};
  try {
    if (request.headers.get("content-length") !== "0") {
      body = await request.json();
    }
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  try {
    const result = await syncEmailIdentities(env, {
      dryRun: body?.dryRun === true,
      enableRouting: body?.enableRouting !== false,
      ensureDestination: body?.ensureDestination !== false,
      updatedBy: auth.email,
    });
    return jsonResponse(result, result.ok ? 200 : 207);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Sync failed" }, 502);
  }
}
