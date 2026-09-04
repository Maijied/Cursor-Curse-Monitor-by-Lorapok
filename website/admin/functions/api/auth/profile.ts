import { verifyAdminRequest, jsonResponse, requirePermission } from "../_shared/auth.js";
import {
  readUserProfile,
  sanitizeProfileForClient,
  validatePinFormat,
  writeUserProfile,
} from "../_shared/user-profile.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const profile = await readUserProfile(env, auth.email);
  return jsonResponse({
    ok: true,
    profile: sanitizeProfileForClient(profile),
  });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const denied = requirePermission(auth, "profile.write");
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "JSON object required" }, 400);
  }

  const patch = {};

  if (body.displayNameOverride !== undefined) {
    patch.displayNameOverride = String(body.displayNameOverride ?? "").trim().slice(0, 80);
  }

  if (body.clearPin === true) {
    patch.pinHash = "";
    patch.pinSalt = "";
  } else if (body.pinHash !== undefined && body.pinSalt !== undefined) {
    const pinCheck = validatePinFormat(body.pinPlain);
    if (body.pinPlain !== undefined && !pinCheck.ok) {
      return jsonResponse({ error: pinCheck.error }, 400);
    }
    const hash = String(body.pinHash ?? "").trim();
    const salt = String(body.pinSalt ?? "").trim();
    if (!hash || !salt || hash.length > 256 || salt.length > 64) {
      return jsonResponse({ error: "pinHash and pinSalt are required to set a PIN" }, 400);
    }
    patch.pinHash = hash;
    patch.pinSalt = salt;
  }

  const saved = await writeUserProfile(env, auth.email, patch);
  return jsonResponse({ ok: true, profile: sanitizeProfileForClient(saved) });
}
