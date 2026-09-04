import { putKvJsonIfChanged } from "./kv-put.js";
import { readResendIntegrationConfig } from "./resend-integration-config.js";

const USAGE_KV_PREFIX = "service-usage";

/** @type {Record<string, { label: string; monthlyLimit: number | null; dailyLimit: number | null }>} */
export const DEFAULT_SERVICE_LIMITS = {
  resend: { label: "Resend", monthlyLimit: 3000, dailyLimit: 100 },
  cloudflareEmail: { label: "Cloudflare Email", monthlyLimit: null, dailyLimit: 200 },
  mailRelay: { label: "Mail relay", monthlyLimit: null, dailyLimit: null },
};

export function utcMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function usageKvKey(month = utcMonthKey()) {
  return `${USAGE_KV_PREFIX}:${month}`;
}

/**
 * @param {unknown} parsed
 */
export function normalizeServiceUsageRecord(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { services: {}, probes: {}, updatedAt: null };
  }
  const record = /** @type {Record<string, unknown>} */ (parsed);
  return {
    services: record.services && typeof record.services === "object" ? record.services : {},
    probes: record.probes && typeof record.probes === "object" ? record.probes : {},
    updatedAt: record.updatedAt ?? null,
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} [month]
 */
export async function readServiceUsage(env, month = utcMonthKey()) {
  if (!env?.ADMIN_KV?.get) return normalizeServiceUsageRecord(null);
  try {
    const raw = await env.ADMIN_KV.get(usageKvKey(month));
    if (!raw) return normalizeServiceUsageRecord(null);
    return normalizeServiceUsageRecord(JSON.parse(raw));
  } catch {
    return normalizeServiceUsageRecord(null);
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {ReturnType<typeof normalizeServiceUsageRecord>} record
 * @param {string} [month]
 */
export async function writeServiceUsage(env, record, month = utcMonthKey()) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await putKvJsonIfChanged(env.ADMIN_KV, usageKvKey(month), {
    ...record,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * @param {ReturnType<typeof normalizeServiceUsageRecord>} record
 * @param {string} serviceId
 */
export function getServiceCounts(record, serviceId) {
  const svc = /** @type {Record<string, unknown>} */ (record.services?.[serviceId] ?? {});
  const day = utcDayKey();
  const dailyMap = svc.daily && typeof svc.daily === "object" ? svc.daily : {};
  return {
    monthly: Number(svc.monthly ?? 0) || 0,
    daily: Number(/** @type {Record<string, unknown>} */ (dailyMap)[day] ?? 0) || 0,
  };
}

/**
 * @param {string} serviceId
 * @param {Record<string, { monthlyLimit?: number | null; dailyLimit?: number | null }>} limits
 * @param {{ monthly: number; daily: number }} counts
 */
export function isServiceQuotaAvailable(serviceId, limits, counts) {
  const cfg = limits[serviceId] ?? DEFAULT_SERVICE_LIMITS[serviceId] ?? {};
  if (cfg.monthlyLimit != null && counts.monthly >= cfg.monthlyLimit) return false;
  if (cfg.dailyLimit != null && counts.daily >= cfg.dailyLimit) return false;
  return true;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} serviceId
 * @param {number} [amount]
 */
export async function incrementServiceUsage(env, serviceId, amount = 1) {
  const month = utcMonthKey();
  const day = utcDayKey();
  const record = await readServiceUsage(env, month);
  const existing = /** @type {Record<string, unknown>} */ (record.services[serviceId] ?? {});
  const dailyMap =
    existing.daily && typeof existing.daily === "object"
      ? /** @type {Record<string, number>} */ (existing.daily)
      : {};
  const nextDaily = { ...dailyMap, [day]: (Number(dailyMap[day]) || 0) + amount };
  record.services[serviceId] = {
    ...existing,
    monthly: (Number(existing.monthly) || 0) + amount,
    daily: nextDaily,
  };
  await writeServiceUsage(env, record, month);
  return getServiceCounts(record, serviceId);
}

/**
 * @param {Record<string, unknown>} env
 */
export async function resolveServiceLimits(env) {
  let resendMeta = {};
  try {
    resendMeta = await readResendIntegrationConfig(env);
  } catch {
    resendMeta = {};
  }
  const monthly =
    typeof resendMeta.monthlyEmailLimit === "number" && resendMeta.monthlyEmailLimit > 0
      ? resendMeta.monthlyEmailLimit
      : DEFAULT_SERVICE_LIMITS.resend.monthlyLimit;
  const daily =
    typeof resendMeta.dailyEmailLimit === "number" && resendMeta.dailyEmailLimit > 0
      ? resendMeta.dailyEmailLimit
      : DEFAULT_SERVICE_LIMITS.resend.dailyLimit;
  return {
    resend: { ...DEFAULT_SERVICE_LIMITS.resend, monthlyLimit: monthly, dailyLimit: daily },
    cloudflareEmail: { ...DEFAULT_SERVICE_LIMITS.cloudflareEmail },
    mailRelay: { ...DEFAULT_SERVICE_LIMITS.mailRelay },
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ resendConfigured?: boolean; relayBound?: boolean; restConfigured?: boolean }} transport
 */
export async function buildServiceQuotaSnapshot(env, transport = {}) {
  const limits = await resolveServiceLimits(env);
  const usage = await readServiceUsage(env);
  const resendConfigured = Boolean(transport.resendConfigured);
  const relayBound = Boolean(transport.relayBound);
  const restConfigured = Boolean(transport.restConfigured);

  const services = Object.keys(DEFAULT_SERVICE_LIMITS).map((id) => {
    const counts = getServiceCounts(usage, id);
    const lim = limits[id] ?? DEFAULT_SERVICE_LIMITS[id];
    const probe = /** @type {{ ok?: boolean } | null} */ (usage.probes?.[id] ?? null);
    const configured =
      id === "resend"
        ? resendConfigured
        : id === "mailRelay"
          ? relayBound
          : restConfigured || relayBound;
    const available = isServiceQuotaAvailable(id, limits, counts) && configured;
    return {
      id,
      label: lim.label,
      used: counts.monthly,
      limit: lim.monthlyLimit,
      dailyUsed: counts.daily,
      dailyLimit: lim.dailyLimit,
      remaining: lim.monthlyLimit != null ? Math.max(0, lim.monthlyLimit - counts.monthly) : null,
      quotaAvailable: isServiceQuotaAvailable(id, limits, counts),
      available,
      configured,
      probeOk: probe?.ok ?? null,
      fallbackTo:
        id === "resend"
          ? ["mailRelay", "cloudflareEmail"]
          : id === "cloudflareEmail"
            ? ["mailRelay", "resend"]
            : ["cloudflareEmail", "resend"],
    };
  });

  return { services, updatedAt: usage.updatedAt ?? null };
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ resendConfigured?: boolean; relayBound?: boolean; restConfigured?: boolean }} transport
 */
export async function probeAndSyncServiceUsage(env, transport) {
  const probes = {
    resend: {
      ok: Boolean(transport.resendConfigured),
      configured: Boolean(transport.resendConfigured),
      checkedAt: new Date().toISOString(),
    },
    mailRelay: {
      ok: Boolean(transport.relayBound),
      configured: Boolean(transport.relayBound),
      checkedAt: new Date().toISOString(),
    },
    cloudflareEmail: {
      ok: Boolean(transport.restConfigured || transport.relayBound),
      configured: Boolean(transport.restConfigured || transport.relayBound),
      checkedAt: new Date().toISOString(),
    },
  };
  const month = utcMonthKey();
  const record = await readServiceUsage(env, month);
  record.probes = probes;
  await writeServiceUsage(env, record, month);
  return buildServiceQuotaSnapshot(env, transport);
}

/**
 * Estimate whether a broadcast can send via Resend for all recipients.
 * @param {Record<string, unknown>} env
 * @param {number} recipientCount
 */
export async function estimateBroadcastResendCapacity(env, recipientCount) {
  const limits = await resolveServiceLimits(env);
  const usage = await readServiceUsage(env);
  const counts = getServiceCounts(usage, "resend");
  const resendLimits = limits.resend;
  const monthlyRemaining =
    resendLimits.monthlyLimit != null ? Math.max(0, resendLimits.monthlyLimit - counts.monthly) : recipientCount;
  const dailyRemaining =
    resendLimits.dailyLimit != null ? Math.max(0, resendLimits.dailyLimit - counts.daily) : recipientCount;
  const resendSlots = Math.min(monthlyRemaining, dailyRemaining);
  return {
    recipientCount,
    resendSlots,
    willUseFallback: recipientCount > resendSlots,
    fallbackCount: Math.max(0, recipientCount - resendSlots),
  };
}
