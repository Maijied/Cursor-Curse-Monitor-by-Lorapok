const PROFILE_PREFIX = "user-profile:v1:";

/**
 * @param {string} email
 */
export function profileKvKey(email) {
  return `${PROFILE_PREFIX}${String(email ?? "").trim().toLowerCase()}`;
}

/**
 * @param {import("./admins.js").Env} env
 * @param {string} email
 */
export async function readUserProfile(env, email) {
  if (!env.ADMIN_KV?.get) return null;
  try {
    const raw = await env.ADMIN_KV.get(profileKvKey(email));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {import("./admins.js").Env} env
 * @param {string} email
 * @param {Record<string, unknown>} patch
 */
export async function writeUserProfile(env, email, patch) {
  if (!env.ADMIN_KV?.put) throw new Error("ADMIN_KV binding not configured");
  const current = (await readUserProfile(env, email)) ?? {};
  const next = {
    ...current,
    ...patch,
    email: String(email).trim().toLowerCase(),
    updatedAt: new Date().toISOString(),
  };
  await env.ADMIN_KV.put(profileKvKey(email), JSON.stringify(next));
  return next;
}

/**
 * @param {string} pin
 */
export function validatePinFormat(pin) {
  const value = String(pin ?? "").trim();
  if (!/^\d{4,6}$/.test(value)) {
    return { ok: false, error: "PIN must be 4–6 digits" };
  }
  return { ok: true, value };
}

/**
 * @param {Record<string, unknown>|null} profile
 */
export function sanitizeProfileForClient(profile) {
  if (!profile) return { pinConfigured: false };
  return {
    pinConfigured: Boolean(profile.pinHash && profile.pinSalt),
    displayNameOverride:
      typeof profile.displayNameOverride === "string" ? profile.displayNameOverride : "",
    updatedAt: typeof profile.updatedAt === "string" ? profile.updatedAt : undefined,
  };
}
