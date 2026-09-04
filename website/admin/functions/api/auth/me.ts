import { verifyAdminRequest, jsonResponse } from "../_shared/auth.js";
import { readUserProfile, sanitizeProfileForClient } from "../_shared/user-profile.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const profile = await readUserProfile(env, auth.email);

  return jsonResponse({
    ok: true,
    user: {
      email: auth.email,
      role: auth.role,
      permissions: auth.permissions,
      isMaster: auth.isMaster,
      profile: sanitizeProfileForClient(profile),
    },
  });
}
