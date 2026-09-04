/**
 * Cloudflare Email Routing API helpers for @lorapok.tech identities.
 */

const API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * @param {Record<string, unknown>} env
 */
function resolveApiToken(env) {
  const token =
    (typeof env.CLOUDFLARE_API_TOKEN === "string" && env.CLOUDFLARE_API_TOKEN.trim()) ||
    (typeof env.CLOUDFLARE_EMAIL_API_TOKEN === "string" && env.CLOUDFLARE_EMAIL_API_TOKEN.trim()) ||
    "";
  return token || null;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} path
 * @param {RequestInit} [init]
 */
export async function cloudflareApiRequest(env, path, init = {}) {
  const token = resolveApiToken(env);
  if (!token) {
    return { ok: false, status: 503, errors: [{ message: "Cloudflare API token not configured" }] };
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.success !== false, status: res.status, ...data };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} [domain]
 */
export async function resolveZoneIdForDomain(env, domain = "lorapok.tech") {
  if (typeof env.CLOUDFLARE_ZONE_ID === "string" && env.CLOUDFLARE_ZONE_ID.trim()) {
    return env.CLOUDFLARE_ZONE_ID.trim();
  }
  const result = await cloudflareApiRequest(env, `/zones?name=${encodeURIComponent(domain)}`);
  if (!result.ok) {
    throw new Error(result.errors?.[0]?.message ?? "Failed to resolve Cloudflare zone");
  }
  const zoneId = result.result?.[0]?.id;
  if (!zoneId) throw new Error(`Zone not found for ${domain}`);
  return zoneId;
}

/**
 * @param {Record<string, unknown>} env
 */
function resolveAccountId(env) {
  const id = typeof env.CLOUDFLARE_ACCOUNT_ID === "string" ? env.CLOUDFLARE_ACCOUNT_ID.trim() : "";
  return id || "f049faaf2f67549f5c58837479596a4a";
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} email
 */
export async function ensureRoutingDestination(env, email) {
  const accountId = resolveAccountId(env);
  const result = await cloudflareApiRequest(env, `/accounts/${accountId}/email/routing/addresses`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (result.ok) {
    return { ok: true, created: true, message: `Destination ${email} added or already present` };
  }
  const message = result.errors?.[0]?.message ?? "Failed to ensure routing destination";
  if (/already exists|duplicate/i.test(message)) {
    return { ok: true, created: false, message: `Destination ${email} already exists` };
  }
  return { ok: false, created: false, message };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} [domain]
 */
export async function enableZoneEmailRouting(env, domain = "lorapok.tech") {
  const zoneId = await resolveZoneIdForDomain(env, domain);
  const result = await cloudflareApiRequest(env, `/zones/${zoneId}/email/routing/enable`, {
    method: "POST",
  });
  if (result.ok) {
    return { ok: true, message: `Email Routing enabled for ${domain}` };
  }
  const message = result.errors?.[0]?.message ?? "Failed to enable Email Routing";
  if (/already enabled/i.test(message)) {
    return { ok: true, message: `Email Routing already enabled for ${domain}` };
  }
  return { ok: false, message };
}

/**
 * @param {unknown[]} rules
 * @param {string} address
 */
export function findRoutingRuleForAddress(rules, address) {
  const needle = String(address).trim().toLowerCase();
  return rules.find((rule) =>
    rule?.matchers?.some((matcher) => matcher.field === "to" && String(matcher.value).toLowerCase() === needle)
  );
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} zoneId
 */
export async function listEmailRoutingRules(env, zoneId) {
  const result = await cloudflareApiRequest(env, `/zones/${zoneId}/email/routing/rules`);
  if (!result.ok) {
    throw new Error(result.errors?.[0]?.message ?? "Failed to list email routing rules");
  }
  return Array.isArray(result.result) ? result.result : [];
}

/**
 * @param {Record<string, unknown>} env
 * @param {{
 *   zoneId: string;
 *   name: string;
 *   address: string;
 *   forwardTo: string;
 * }} params
 */
export async function createForwardRoutingRule(env, params) {
  const body = {
    name: params.name,
    enabled: true,
    matchers: [{ type: "literal", field: "to", value: params.address }],
    actions: [{ type: "forward", value: [params.forwardTo] }],
  };

  const result = await cloudflareApiRequest(env, `/zones/${params.zoneId}/email/routing/rules`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!result.ok) {
    const message = result.errors?.[0]?.message ?? "Failed to create routing rule";
    throw new Error(message);
  }

  return result.result;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} address
 * @param {string} forwardTo
 */
export async function provisionIdentityRouting(env, { address, forwardTo, ruleName }) {
  const token = resolveApiToken(env);
  if (!token) {
    return {
      simulated: true,
      routingStatus: "simulated",
      cloudflareRuleId: null,
      message: "No Cloudflare token — recorded in KV only (dev/simulated)",
    };
  }

  const zoneId = await resolveZoneIdForDomain(env, address.split("@")[1] ?? "lorapok.tech");
  const existing = await listEmailRoutingRules(env, zoneId);
  const match = existing.find((rule) =>
    rule.matchers?.some((m) => m.field === "to" && m.value?.toLowerCase() === address.toLowerCase())
  );
  if (match?.id) {
    return {
      simulated: false,
      routingStatus: "provisioned",
      cloudflareRuleId: String(match.id),
      message: "Existing Cloudflare routing rule reused",
    };
  }

  const created = await createForwardRoutingRule(env, {
    zoneId,
    name: ruleName,
    address,
    forwardTo,
  });

  return {
    simulated: false,
    routingStatus: "provisioned",
    cloudflareRuleId: created?.id ? String(created.id) : null,
    message: "Cloudflare routing rule created",
  };
}
