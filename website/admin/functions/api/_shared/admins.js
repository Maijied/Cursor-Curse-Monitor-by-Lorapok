const DEFAULT_MASTER = "admin@lorapok.tech";
const KV_KEY = "admin-emails";

export function getMasterEmail(env) {
  return (env.ADMIN_MASTER_EMAIL ?? DEFAULT_MASTER).trim().toLowerCase();
}

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
  const master = getMasterEmail(env);
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
