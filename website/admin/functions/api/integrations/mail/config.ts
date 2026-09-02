import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  isValidMailAddress,
  readMailConfig,
  sanitizeMailConfigForClient,
  writeMailConfig,
} from "../../_shared/mail-config.js";
import { getMailTransportStatus } from "../../_shared/mail.js";

/**
 * Retrieves mail transport and identity settings for an authenticated administrator.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const config = await readMailConfig(env);
  const transport = getMailTransportStatus(env);
  return jsonResponse({ ok: true, config: sanitizeMailConfigForClient(config, transport, env) });
}

/**
 * Updates outbound mail identities and routing preferences (master admin only).
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  if (!auth.isMaster) {
    return jsonResponse({ error: "Master admin only" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Request body must be a JSON object" }, 400);
  }

  const patch = /** @type {Record<string, unknown>} */ ({ updatedBy: auth.email });

  if (body.productEmail !== undefined) {
    const email = String(body.productEmail ?? "").trim();
    if (!isValidMailAddress(email)) {
      return jsonResponse({ error: "Invalid product email address" }, 400);
    }
    patch.productEmail = email;
  }
  if (body.supportEmail !== undefined) {
    const email = String(body.supportEmail ?? "").trim();
    if (!isValidMailAddress(email)) {
      return jsonResponse({ error: "Invalid support email address" }, 400);
    }
    patch.supportEmail = email;
  }
  if (body.opsBccEmail !== undefined) {
    const email = String(body.opsBccEmail ?? "").trim();
    if (!isValidMailAddress(email)) {
      return jsonResponse({ error: "Invalid ops BCC email address" }, 400);
    }
    patch.opsBccEmail = email;
  }
  if (body.productFromName !== undefined) {
    patch.productFromName = String(body.productFromName ?? "").trim();
  }
  if (body.supportFromName !== undefined) {
    patch.supportFromName = String(body.supportFromName ?? "").trim();
  }
  if (body.resendFirstExternal !== undefined) {
    if (typeof body.resendFirstExternal !== "boolean") {
      return jsonResponse({ error: "resendFirstExternal must be a boolean" }, 400);
    }
    patch.resendFirstExternal = body.resendFirstExternal;
  }

  if (
    body.productEmail === undefined &&
    body.supportEmail === undefined &&
    body.opsBccEmail === undefined &&
    body.productFromName === undefined &&
    body.supportFromName === undefined &&
    body.resendFirstExternal === undefined
  ) {
    return jsonResponse({ error: "At least one mail setting is required" }, 400);
  }

  try {
    const config = await writeMailConfig(env, patch);
    const transport = getMailTransportStatus(env);
    return jsonResponse({ ok: true, config: sanitizeMailConfigForClient(config, transport, env) });
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503);
  }
}
