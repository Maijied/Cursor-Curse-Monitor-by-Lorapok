import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  IDENTITY_CATEGORIES,
  readEmailIdentitiesConfig,
  sanitizeEmailIdentitiesForClient,
  upsertIdentity,
  validateIdentityLocalPart,
  writeEmailIdentitiesConfig,
} from "../../_shared/email-identities-config.js";
import { isValidMailAddress } from "../../_shared/mail-config.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "settings.read");
  if (readDenied) return readDenied;

  const config = await readEmailIdentitiesConfig(env);
  return jsonResponse({ ok: true, config: sanitizeEmailIdentitiesForClient(config) });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "settings.write");
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "JSON object required" }, 400);
  }

  const current = await readEmailIdentitiesConfig(env);
  let next = { ...current };

  if (body.opsForwardTo !== undefined) {
    const forwardTo = String(body.opsForwardTo ?? "").trim().toLowerCase();
    if (!isValidMailAddress(forwardTo)) {
      return jsonResponse({ error: "Invalid ops forward address" }, 400);
    }
    next.opsForwardTo = forwardTo;
  }

  if (Array.isArray(body.identities)) {
    for (const entry of body.identities) {
      const localPart = String(entry?.localPart ?? "").trim().toLowerCase();
      const check = validateIdentityLocalPart(localPart);
      if (!check.ok) {
        return jsonResponse({ error: check.error }, 400);
      }
      const category = String(entry?.category ?? "custom").toLowerCase();
      if (!IDENTITY_CATEGORIES.includes(category)) {
        return jsonResponse({ error: `Invalid category: ${category}` }, 400);
      }
      const forwardTo = String(entry?.forwardTo ?? next.opsForwardTo).trim().toLowerCase();
      if (!isValidMailAddress(forwardTo)) {
        return jsonResponse({ error: `Invalid forward target for ${localPart}` }, 400);
      }
      next = upsertIdentity(next, localPart, {
        displayName: entry?.displayName,
        category,
        forwardTo,
        enabled: entry?.enabled !== false,
      });
    }
  }

  next.updatedAt = new Date().toISOString();
  next.updatedBy = auth.email;

  try {
    await writeEmailIdentitiesConfig(env, next);
    return jsonResponse({ ok: true, config: sanitizeEmailIdentitiesForClient(next) });
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503);
  }
}
