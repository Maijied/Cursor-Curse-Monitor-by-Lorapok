import {
  enableZoneEmailRouting,
  ensureRoutingDestination,
  findRoutingRuleForAddress,
  listEmailRoutingRules,
  provisionIdentityRouting,
  resolveZoneIdForDomain,
} from "./cloudflare-email-routing.js";
import {
  identityEmail,
  readEmailIdentitiesConfig,
  sanitizeEmailIdentitiesForClient,
  upsertIdentity,
  writeEmailIdentitiesConfig,
} from "./email-identities-config.js";
import { isValidMailAddress } from "./mail-config.js";

/**
 * Bulk sync @lorapok.tech identities — parity with setup-email-addresses.mjs.
 *
 * @param {Record<string, unknown>} env
 * @param {{
 *   dryRun?: boolean;
 *   enableRouting?: boolean;
 *   ensureDestination?: boolean;
 *   updatedBy?: string;
 *   config?: ReturnType<typeof import("./email-identities-config.js").normalizeEmailIdentitiesConfig>;
 *   persist?: boolean;
 * }} [options]
 */
export async function syncEmailIdentities(env, options = {}) {
  const dryRun = options.dryRun === true;
  const enableRouting = options.enableRouting !== false;
  const ensureDestination = options.ensureDestination !== false;
  const persist = options.persist !== false && Boolean(env?.ADMIN_KV?.put);
  const updatedBy = options.updatedBy ?? "system";

  let config = options.config ?? await readEmailIdentitiesConfig(env);
  const opsForwardTo = String(config.opsForwardTo ?? "").trim().toLowerCase();
  if (!isValidMailAddress(opsForwardTo)) {
    throw new Error("Valid opsForwardTo is required in email identities config");
  }

  const steps = [];
  const results = [];
  let zoneId = null;
  let rules = [];

  const hasToken =
    Boolean(env?.CLOUDFLARE_API_TOKEN?.trim()) || Boolean(env?.CLOUDFLARE_EMAIL_API_TOKEN?.trim());

  if (!hasToken && !dryRun) {
    for (const identity of config.identities.filter((item) => item.enabled !== false)) {
      results.push({
        localPart: identity.localPart,
        email: identityEmail(identity.localPart, config.domain),
        ok: true,
        routingStatus: "simulated",
        message: "No Cloudflare token — simulated only",
      });
      config = upsertIdentity(config, identity.localPart, {
        routingStatus: "simulated",
        provisionedAt: new Date().toISOString(),
      });
    }
    config = { ...config, updatedAt: new Date().toISOString(), updatedBy };
    if (persist) await writeEmailIdentitiesConfig(env, config);
    return {
      ok: true,
      dryRun,
      simulated: true,
      steps,
      results,
      config: sanitizeEmailIdentitiesForClient(config),
      summary: { total: results.length, provisioned: 0, reused: 0, failed: 0, simulated: results.length },
    };
  }

  if (!dryRun && enableRouting) {
    try {
      const routing = await enableZoneEmailRouting(env, config.domain);
      steps.push({ step: "enableRouting", ok: routing.ok, message: routing.message });
    } catch (err) {
      steps.push({
        step: "enableRouting",
        ok: false,
        message: err instanceof Error ? err.message : "enable routing failed",
      });
    }
  }

  if (!dryRun && ensureDestination) {
    try {
      const destination = await ensureRoutingDestination(env, opsForwardTo);
      steps.push({
        step: "ensureDestination",
        ok: destination.ok,
        message: destination.message,
      });
    } catch (err) {
      steps.push({
        step: "ensureDestination",
        ok: false,
        message: err instanceof Error ? err.message : "ensure destination failed",
      });
    }
  }

  if (!dryRun && hasToken) {
    zoneId = await resolveZoneIdForDomain(env, config.domain);
    rules = await listEmailRoutingRules(env, zoneId);
  }

  for (const identity of config.identities.filter((item) => item.enabled !== false)) {
    const address = identityEmail(identity.localPart, config.domain);
    const forwardTo = String(identity.forwardTo ?? opsForwardTo).trim().toLowerCase();
    const ruleName = identity.localPart.replace(/\./g, "-");

    if (dryRun) {
      results.push({
        localPart: identity.localPart,
        email: address,
        ok: true,
        routingStatus: "pending",
        message: "Dry run — no Cloudflare API call",
      });
      continue;
    }

    try {
      const existingRule = rules.length ? findRoutingRuleForAddress(rules, address) : null;
      const provision = existingRule
        ? {
            simulated: false,
            routingStatus: "provisioned",
            cloudflareRuleId: String(existingRule.id),
            message: "Existing Cloudflare routing rule reused",
          }
        : await provisionIdentityRouting(env, {
            address,
            forwardTo,
            ruleName,
          });

      config = upsertIdentity(config, identity.localPart, {
        displayName: identity.displayName,
        category: identity.category,
        forwardTo,
        enabled: true,
        routingStatus: provision.routingStatus,
        cloudflareRuleId: provision.cloudflareRuleId,
        provisionedAt: new Date().toISOString(),
      });

      results.push({
        localPart: identity.localPart,
        email: address,
        ok: true,
        routingStatus: provision.routingStatus,
        cloudflareRuleId: provision.cloudflareRuleId,
        message: provision.message,
        reused: Boolean(existingRule),
      });

      if (!existingRule && provision.cloudflareRuleId && rules.length) {
        rules = await listEmailRoutingRules(env, zoneId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Provision failed";
      config = upsertIdentity(config, identity.localPart, {
        routingStatus: "error",
      });
      results.push({
        localPart: identity.localPart,
        email: address,
        ok: false,
        routingStatus: "error",
        message,
      });
    }
  }

  config = { ...config, updatedAt: new Date().toISOString(), updatedBy };
  if (persist) {
    await writeEmailIdentitiesConfig(env, config);
  }

  const summary = {
    total: results.length,
    provisioned: results.filter((r) => r.ok && r.routingStatus === "provisioned" && !r.reused).length,
    reused: results.filter((r) => r.ok && r.reused).length,
    failed: results.filter((r) => !r.ok).length,
    simulated: results.filter((r) => r.routingStatus === "simulated" || r.routingStatus === "pending").length,
  };

  return {
    ok: summary.failed === 0,
    dryRun,
    simulated: !hasToken,
    steps,
    results,
    config: sanitizeEmailIdentitiesForClient(config),
    summary,
  };
}
