import { putKvJsonIfChanged } from "./kv-put.js";
import { logSystemEvent } from "./system-log.js";
import { readMailConfig, isValidMailAddress } from "./mail-config.js";
import { readEmailIdentitiesConfig, identityEmail, BUILTIN_IDENTITIES } from "./email-identities-config.js";
import { getMailTransportStatus } from "./mail.js";

export const MAIL_DELIVERABILITY_KEY = "integrations:mail-deliverability";

/**
 * @param {Record<string, unknown>} env
 */
export async function collectMailAuditAddresses(env) {
  const mailConfig = await readMailConfig(env);
  const identitiesConfig = await readEmailIdentitiesConfig(env);
  const domain = identitiesConfig.domain ?? "lorapok.tech";
  const seen = new Set();
  const rows = [];

  const add = (address, source, extra = {}) => {
    const email = String(address ?? "").trim().toLowerCase();
    if (!email || seen.has(email)) return;
    seen.add(email);
    rows.push({ address: email, source, ...extra });
  };

  add(mailConfig.productEmail, "mail-config.product");
  add(mailConfig.supportEmail, "mail-config.support");
  if (mailConfig.opsBccEmail) add(mailConfig.opsBccEmail, "mail-config.opsBcc");
  if (mailConfig.resendFromOverride) add(mailConfig.resendFromOverride, "mail-config.resendOverride");

  for (const identity of identitiesConfig.identities ?? BUILTIN_IDENTITIES) {
    if (identity.enabled === false) continue;
    add(identityEmail(identity.localPart, domain), `identity.${identity.category}`, {
      routingStatus: identity.routingStatus ?? "pending",
    });
  }

  return rows;
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ address: string; source: string; routingStatus?: string }} row
 * @param {{ transport: ReturnType<typeof getMailTransportStatus>; mailConfig: Awaited<ReturnType<typeof readMailConfig>> }} ctx
 */
export function auditMailAddress(row, ctx) {
  const checks = [];
  const address = row.address;
  const domain = address.split("@")[1] ?? "";

  if (!isValidMailAddress(address)) {
    checks.push({ id: "format", ok: false, detail: "Invalid email format" });
  } else {
    checks.push({ id: "format", ok: true, detail: "Valid format" });
  }

  const transportReady = ctx.transport.configured === true;
  checks.push({
    id: "transport",
    ok: transportReady,
    detail: transportReady ? `Transport: ${ctx.transport.transport}` : "No outbound transport",
  });

  const isResendDomain = domain === ctx.mailConfig.sendingDomain;
  const isIdentityDomain = domain === "lorapok.tech";
  let domainOk = true;
  let domainDetail = "Identity domain";

  if (isResendDomain) {
    domainOk = ctx.mailConfig.resendDomainVerified === true || ctx.transport.resendConfigured === true;
    domainDetail = domainOk ? "Resend / sending domain ready" : "Resend domain not verified";
  } else if (isIdentityDomain) {
    const routing = row.routingStatus ?? "builtin";
    domainOk = routing === "builtin" || routing === "active" || routing === "provisioned";
    domainDetail = `Routing: ${routing}`;
  }

  checks.push({ id: "domain", ok: domainOk, detail: domainDetail });

  const ok = checks.every((c) => c.ok);
  return { address, source: row.source, ok, checks };
}

/**
 * @param {Record<string, unknown>} env
 */
export async function runMailDeliverabilityAudit(env) {
  const transport = getMailTransportStatus(env);
  const mailConfig = await readMailConfig(env);
  const addresses = await collectMailAuditAddresses(env);
  const results = addresses.map((row) => auditMailAddress(row, { transport, mailConfig }));
  const allOk = results.length > 0 && results.every((r) => r.ok);
  const ts = new Date().toISOString();

  const snapshot = {
    lastRunAt: ts,
    lastVerifiedAt: allOk ? ts : null,
    allOk,
    transport: transport.transport,
    addressCount: results.length,
    results,
  };

  const previous = await readMailDeliverabilityState(env);
  if (allOk) {
    snapshot.lastVerifiedAt = ts;
  } else if (previous.lastVerifiedAt) {
    snapshot.lastVerifiedAt = previous.lastVerifiedAt;
  }

  if (env?.ADMIN_KV?.put) {
    await putKvJsonIfChanged(env.ADMIN_KV, MAIL_DELIVERABILITY_KEY, snapshot);
  }

  if (!allOk) {
    const failed = results.filter((r) => !r.ok).map((r) => r.address);
    await logSystemEvent(env, {
      level: "warn",
      source: "mail-deliverability",
      message: `Mail deliverability audit failed for ${failed.length} address(es)`,
      meta: { failed, lastRunAt: ts },
    });
  }

  return snapshot;
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readMailDeliverabilityState(env) {
  if (!env?.ADMIN_KV?.get) {
    return { lastRunAt: null, lastVerifiedAt: null, allOk: false, results: [] };
  }
  try {
    const raw = await env.ADMIN_KV.get(MAIL_DELIVERABILITY_KEY);
    if (!raw) return { lastRunAt: null, lastVerifiedAt: null, allOk: false, results: [] };
    const parsed = JSON.parse(raw);
    return {
      lastRunAt: parsed.lastRunAt ?? null,
      lastVerifiedAt: parsed.lastVerifiedAt ?? null,
      allOk: parsed.allOk === true,
      transport: parsed.transport ?? null,
      addressCount: parsed.addressCount ?? 0,
      results: Array.isArray(parsed.results) ? parsed.results : [],
    };
  } catch {
    return { lastRunAt: null, lastVerifiedAt: null, allOk: false, results: [] };
  }
}
