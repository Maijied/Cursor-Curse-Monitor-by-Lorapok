/**
 * Master admin email — must come from ADMIN_MASTER_EMAIL (Functions/Pages) or
 * VITE_ADMIN_MASTER_EMAIL (SPA). Never hardcode a personal address in source.
 */
export function getMasterEmail(env) {
  const email = tryGetMasterEmail(env);
  if (!email) {
    throw new Error("ADMIN_MASTER_EMAIL is not configured");
  }
  return email;
}

/** Returns master email when configured; null when missing (invite-check / allowlist must not throw). */
export function tryGetMasterEmail(env) {
  const email = String(
    env.ADMIN_MASTER_EMAIL ?? env.VITE_ADMIN_MASTER_EMAIL ?? ""
  )
    .trim()
    .toLowerCase();
  return email || null;
}

const KV_KEY = "admin-emails";

function parseEnvEmails(env) {
  const raw = env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function readKvEmails(env) {
  if (!env.ADMIN_KV?.get) return [];
  try {
    const raw = await env.ADMIN_KV.get(KV_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((e) => String(e).toLowerCase()) : [];
  } catch {
    return [];
  }
}

export async function getAllowedAdminEmails(env) {
  const master = tryGetMasterEmail(env);
  const envEmails = parseEnvEmails(env);
  const kvEmails = await readKvEmails(env);
  return new Set([master, ...envEmails, ...kvEmails].filter(Boolean));
}

export async function listStoredAdminEmails(env) {
  return [...(await readKvEmails(env))].sort();
}

export async function writeStoredAdminEmails(env, emails) {
  if (!env.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))].sort();
  await env.ADMIN_KV.put(KV_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function addStoredAdminEmail(env, email) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("email is required");
  const current = await readKvEmails(env);
  if (!current.includes(normalized)) current.push(normalized);
  return writeStoredAdminEmails(env, current);
}

export async function removeStoredAdminEmail(env, email) {
  const normalized = email.trim().toLowerCase();
  const current = await readKvEmails(env);
  return writeStoredAdminEmails(
    env,
    current.filter((e) => e !== normalized)
  );
}

export function isMasterEmail(env, email) {
  return email?.toLowerCase() === getMasterEmail(env);
}
