/**
 * Mission Control RBAC — permission matrix (AUTH-01).
 * Server is source of truth; mirror in `src/lib/rbac.ts` for UI gating.
 */

export const ROLES = ["master", "admin", "operator", "viewer"];

/** @typedef {'master'|'admin'|'operator'|'viewer'} AdminRole */

export const PERMISSIONS = [
  "settings.read",
  "settings.write",
  "integrations.read",
  "integrations.write",
  "mail.read",
  "mail.send",
  "mail.provision",
  "team.manage",
  "secrets.manage",
  "deploy.run",
  "deploy.infra",
  "notices.write",
  "subscribers.write",
  "logs.read",
  "profile.write",
];

const KV_KEY = "admin-rbac:v1";

/** @type {Record<string, readonly string[]>} */
export const ROLE_PERMISSIONS = {
  master: ["*"],
  admin: [
    "settings.read",
    "integrations.read",
    "integrations.write",
    "mail.read",
    "mail.send",
    "notices.write",
    "subscribers.write",
    "logs.read",
    "profile.write",
  ],
  operator: ["mail.read", "mail.send", "notices.write", "subscribers.write", "logs.read", "profile.write"],
  viewer: ["settings.read", "integrations.read", "mail.read", "logs.read", "profile.write"],
};

/**
 * @param {string} role
 * @returns {Set<string>}
 */
export function permissionsForRole(role) {
  const normalized = String(role ?? "viewer").toLowerCase();
  const list = ROLE_PERMISSIONS[normalized] ?? ROLE_PERMISSIONS.viewer;
  if (list.includes("*")) return new Set(PERMISSIONS);
  return new Set(list);
}

/**
 * @param {Set<string>|string[]} granted
 * @param {string} permission
 */
export function roleHasPermission(granted, permission) {
  const set = granted instanceof Set ? granted : new Set(granted);
  if (set.has("*")) return true;
  return set.has(permission);
}

/**
 * @param {import("./admins.js").Env} env
 * @returns {Promise<Record<string, string>>}
 */
export async function readRbacMap(env) {
  if (!env.ADMIN_KV?.get) return {};
  try {
    const raw = await env.ADMIN_KV.get(KV_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out = {};
    for (const [email, role] of Object.entries(parsed)) {
      const key = String(email).trim().toLowerCase();
      const value = String(role).trim().toLowerCase();
      if (key && ROLES.includes(value) && value !== "master") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * @param {import("./admins.js").Env} env
 * @param {string} email
 * @param {boolean} isMaster
 * @returns {Promise<AdminRole>}
 */
export async function resolveAdminRole(env, email, isMaster) {
  if (isMaster) return "master";
  const map = await readRbacMap(env);
  const assigned = map[email?.toLowerCase() ?? ""];
  if (assigned && ROLES.includes(assigned)) return assigned;
  return "admin";
}

/**
 * @param {import("./admins.js").Env} env
 * @param {string} email
 * @param {boolean} isMaster
 */
export async function buildAdminAuthContext(env, email, isMaster) {
  const role = await resolveAdminRole(env, email, isMaster);
  const permissions = [...permissionsForRole(role)];
  return {
    email,
    isMaster,
    role,
    permissions,
    hasPermission(permission) {
      return roleHasPermission(permissions, permission);
    },
  };
}

/**
 * @param {{ role?: string; permissions?: string[]; isMaster?: boolean; hasPermission?: (p: string) => boolean }} auth
 * @param {string} permission
 */
export function requirePermissionDenied(auth, permission) {
  if (auth?.isMaster || auth?.hasPermission?.(permission)) return false;
  return !roleHasPermission(auth?.permissions ?? [], permission);
}

/**
 * @param {import("./admins.js").Env} env
 * @param {Record<string, string>} map email → role
 */
export async function writeRbacMap(env, map) {
  if (!env.ADMIN_KV?.put) throw new Error("ADMIN_KV binding not configured");
  const normalized = {};
  for (const [email, role] of Object.entries(map)) {
    const key = String(email).trim().toLowerCase();
    const value = String(role).trim().toLowerCase();
    if (key && ROLES.includes(value) && value !== "master") normalized[key] = value;
  }
  await env.ADMIN_KV.put(KV_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function listRbacAssignments(env) {
  const map = await readRbacMap(env);
  return Object.entries(map)
    .map(([email, role]) => ({ email, role }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

/**
 * @param {import("./admins.js").Env} env
 * @param {string} email
 * @param {string} role
 */
export async function assignAdminRole(env, email, role) {
  const key = String(email ?? "").trim().toLowerCase();
  const value = String(role ?? "").trim().toLowerCase();
  if (!key || !key.includes("@")) throw new Error("email is required");
  if (value === "master") throw new Error("Cannot assign master role via API");
  if (!ROLES.includes(value)) throw new Error(`Invalid role: ${value}`);

  const map = await readRbacMap(env);
  map[key] = value;
  await writeRbacMap(env, map);
  return { email: key, role: value };
}

/**
 * @param {import("./admins.js").Env} env
 * @param {string} email
 */
export async function removeAdminRole(env, email) {
  const key = String(email ?? "").trim().toLowerCase();
  if (!key) throw new Error("email is required");
  const map = await readRbacMap(env);
  delete map[key];
  await writeRbacMap(env, map);
  return { email: key, removed: true };
}

/**
 * Effective roles for every allowlisted admin (master + KV admin-emails + env).
 * @param {import("./admins.js").Env} env
 */
export async function buildRbacTeamSnapshot(env) {
  const { getAllowedAdminEmails, tryGetMasterEmail } = await import("./admins.js");
  const allowed = await getAllowedAdminEmails(env);
  const master = tryGetMasterEmail(env);
  const rbacMap = await readRbacMap(env);

  const members = [...allowed]
    .sort((a, b) => a.localeCompare(b))
    .map((email) => {
      if (master && email === master) {
        return { email, role: "master", source: "env" };
      }
      const assigned = rbacMap[email];
      if (assigned) {
        return { email, role: assigned, source: "kv" };
      }
      return { email, role: "admin", source: "default" };
    });

  return {
    members,
    assignments: await listRbacAssignments(env),
  };
}

export { KV_KEY as RBAC_KV_KEY };
