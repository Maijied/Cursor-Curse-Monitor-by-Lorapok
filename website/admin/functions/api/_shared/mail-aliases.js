import { addStoredAdminEmail, removeStoredAdminEmail, tryGetMasterEmail } from "./admins.js";
import { assignAdminRole, removeAdminRole } from "./rbac.js";
import { provisionIdentityRouting } from "./cloudflare-email-routing.js";
import { isValidMailAddress } from "./mail-config.js";
import {
  ALIAS_AUTH_ROLES,
  BUILTIN_IDENTITIES,
  identityEmail,
  isBuiltinIdentity,
  readEmailIdentitiesConfig,
  sanitizeEmailIdentitiesForClient,
  sanitizeIdentityForClient,
  upsertIdentity,
  validateIdentityLocalPart,
  writeEmailIdentitiesConfig,
} from "./email-identities-config.js";

/**
 * @param {ReturnType<typeof import("./email-identities-config.js").normalizeIdentity>} identity
 * @param {string} domain
 */
export function identityToAliasRow(identity, domain) {
  const builtin = BUILTIN_IDENTITIES.some((item) => item.localPart === identity.localPart);
  return {
    localPart: identity.localPart,
    fullAddress: identityEmail(identity.localPart, domain),
    label: identity.label || identity.displayName,
    project: identity.project || null,
    coworkerEmail: identity.coworkerEmail || null,
    displayName: identity.displayName,
    category: identity.category,
    forwardTo: identity.forwardTo,
    role: identity.authRole,
    createdAt: identity.createdAt ?? identity.provisionedAt ?? null,
    enabled: identity.enabled,
    authAllowed: identity.authAllowed === true,
    routingStatus: identity.routingStatus,
    cloudflareRuleId: identity.cloudflareRuleId,
    builtin,
  };
}

/**
 * @param {Record<string, unknown>} env
 */
export async function listMailAliases(env) {
  const config = await readEmailIdentitiesConfig(env);
  return config.identities
    .map((item) => identityToAliasRow(item, config.domain))
    .sort((a, b) => a.localPart.localeCompare(b.localPart));
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} localPart
 */
export async function getMailAlias(env, localPart) {
  const config = await readEmailIdentitiesConfig(env);
  const identity = config.identities.find((item) => item.localPart === String(localPart).trim().toLowerCase());
  if (!identity) return null;
  return identityToAliasRow(identity, config.domain);
}

/**
 * Sync Mission Control login allowlist for an @lorapok.tech alias.
 * @param {Record<string, unknown>} env
 * @param {ReturnType<typeof import("./email-identities-config.js").normalizeIdentity>} identity
 * @param {string} domain
 * @param {{ enable: boolean }} opts
 */
export async function syncAliasAuthAccess(env, identity, domain, { enable }) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }

  const address = identityEmail(identity.localPart, domain);
  const master = tryGetMasterEmail(env);
  if (master && address === master) {
    return { skipped: true, reason: "master_email" };
  }

  if (enable) {
    await addStoredAdminEmail(env, address);
    const role = ALIAS_AUTH_ROLES.includes(identity.authRole) ? identity.authRole : "viewer";
    await assignAdminRole(env, address, role);
    return { synced: true, action: "add", email: address, role };
  }

  await removeStoredAdminEmail(env, address);
  await removeAdminRole(env, address);
  return { synced: true, action: "remove", email: address };
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} input
 * @param {string} actorEmail
 */
export async function createMailAlias(env, input, actorEmail) {
  const localCheck = validateIdentityLocalPart(input?.localPart);
  if (!localCheck.ok) throw new Error(localCheck.error);

  const localPart = localCheck.value;
  const config = await readEmailIdentitiesConfig(env);
  if (config.identities.some((item) => item.localPart === localPart)) {
    throw new Error(`Alias ${identityEmail(localPart, config.domain)} already exists`);
  }

  const forwardTo = String(input?.forwardTo ?? config.opsForwardTo).trim().toLowerCase();
  if (!isValidMailAddress(forwardTo)) {
    throw new Error("Valid forwardTo email is required");
  }

  const coworkerEmail = String(input?.coworkerEmail ?? "").trim().toLowerCase();
  if (coworkerEmail && !isValidMailAddress(coworkerEmail)) {
    throw new Error("Invalid coworkerEmail");
  }

  const authRole = ALIAS_AUTH_ROLES.includes(String(input?.authRole ?? "").toLowerCase())
    ? String(input.authRole).toLowerCase()
    : "viewer";
  const authAllowed = input?.authAllowed === true;
  const address = identityEmail(localPart, config.domain);
  const provisionRouting = input?.provisionRouting !== false;

  let routing = {
    simulated: true,
    routingStatus: "pending",
    cloudflareRuleId: null,
    message: "Routing not requested",
  };

  if (provisionRouting) {
    routing = await provisionIdentityRouting(env, {
      address,
      forwardTo,
      ruleName: localPart.replace(/\./g, "-"),
    });
  }

  let next = upsertIdentity(config, localPart, {
    displayName: String(input?.displayName ?? input?.label ?? localPart).trim().slice(0, 80) || localPart,
    label: String(input?.label ?? input?.displayName ?? localPart).trim().slice(0, 120) || localPart,
    project: String(input?.project ?? "").trim().slice(0, 80),
    coworkerEmail,
    category: String(input?.category ?? "custom").toLowerCase(),
    forwardTo,
    enabled: input?.enabled !== false,
    authAllowed,
    authRole,
    routingStatus: routing.routingStatus,
    cloudflareRuleId: routing.cloudflareRuleId,
    provisionedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });

  let authSync = null;
  if (authAllowed) {
    const identity = next.identities.find((item) => item.localPart === localPart);
    authSync = await syncAliasAuthAccess(env, identity, next.domain, { enable: true });
  }

  next = {
    ...next,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
  };
  await writeEmailIdentitiesConfig(env, next);

  const identity = next.identities.find((item) => item.localPart === localPart);
  return {
    alias: identityToAliasRow(identity, next.domain),
    provision: routing,
    authSync,
    config: sanitizeEmailIdentitiesForClient(next),
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} localPart
 * @param {Record<string, unknown>} patch
 * @param {string} actorEmail
 */
export async function updateMailAlias(env, localPart, patch, actorEmail) {
  const key = String(localPart).trim().toLowerCase();
  const config = await readEmailIdentitiesConfig(env);
  const existing = config.identities.find((item) => item.localPart === key);
  if (!existing) throw new Error("Alias not found");

  const forwardTo = patch.forwardTo !== undefined
    ? String(patch.forwardTo).trim().toLowerCase()
    : existing.forwardTo;
  if (!isValidMailAddress(forwardTo)) {
    throw new Error("Invalid forwardTo email");
  }

  const coworkerEmail = patch.coworkerEmail !== undefined
    ? String(patch.coworkerEmail).trim().toLowerCase()
    : existing.coworkerEmail;
  if (coworkerEmail && !isValidMailAddress(coworkerEmail)) {
    throw new Error("Invalid coworkerEmail");
  }

  const authRole = patch.authRole !== undefined
    ? String(patch.authRole).toLowerCase()
    : existing.authRole;
  if (patch.authRole !== undefined && !ALIAS_AUTH_ROLES.includes(authRole)) {
    throw new Error("Invalid authRole");
  }

  const authAllowed = patch.authAllowed !== undefined ? patch.authAllowed === true : existing.authAllowed === true;
  const previousAuth = existing.authAllowed === true;

  let next = upsertIdentity(config, key, {
    displayName: patch.displayName ?? existing.displayName,
    label: patch.label ?? existing.label,
    project: patch.project !== undefined ? String(patch.project).trim().slice(0, 80) : existing.project,
    coworkerEmail,
    category: patch.category ?? existing.category,
    forwardTo,
    enabled: patch.enabled !== undefined ? patch.enabled !== false : existing.enabled,
    authAllowed,
    authRole,
  });

  const identity = next.identities.find((item) => item.localPart === key);
  let authSync = null;
  if (authAllowed !== previousAuth) {
    authSync = await syncAliasAuthAccess(env, identity, next.domain, { enable: authAllowed });
  } else if (authAllowed && patch.authRole !== undefined && patch.authRole !== existing.authRole) {
    authSync = await syncAliasAuthAccess(env, identity, next.domain, { enable: true });
  }

  next = {
    ...next,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
  };
  await writeEmailIdentitiesConfig(env, next);

  const updated = next.identities.find((item) => item.localPart === key);
  return {
    alias: identityToAliasRow(updated, next.domain),
    authSync,
    config: sanitizeEmailIdentitiesForClient(next),
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} localPart
 * @param {string} actorEmail
 */
export async function deleteMailAlias(env, localPart, actorEmail) {
  const key = String(localPart).trim().toLowerCase();
  const config = await readEmailIdentitiesConfig(env);
  const existing = config.identities.find((item) => item.localPart === key);
  if (!existing) throw new Error("Alias not found");
  if (isBuiltinIdentity(config, key)) {
    throw new Error("Built-in aliases cannot be deleted");
  }

  let authSync = null;
  if (existing.authAllowed) {
    authSync = await syncAliasAuthAccess(env, existing, config.domain, { enable: false });
  }

  const next = {
    ...config,
    identities: config.identities.filter((item) => item.localPart !== key),
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
  };
  await writeEmailIdentitiesConfig(env, next);

  return {
    deleted: identityToAliasRow(existing, config.domain),
    authSync,
    config: sanitizeEmailIdentitiesForClient(next),
    routingNote: "Cloudflare routing rule was not auto-deleted — remove manually if needed.",
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} localPart
 */
export async function resolveAliasFromAddress(env, localPart) {
  const config = await readEmailIdentitiesConfig(env);
  const identity = config.identities.find(
    (item) => item.localPart === String(localPart).trim().toLowerCase() && item.enabled !== false
  );
  if (!identity) return null;
  return {
    email: identityEmail(identity.localPart, config.domain),
    name: identity.displayName,
    replyTo: identityEmail(identity.localPart, config.domain),
    identity: sanitizeIdentityForClient(identity, config.domain),
  };
}
