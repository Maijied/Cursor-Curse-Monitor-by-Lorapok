import { putKvJsonSafe } from "./kv-put.js";

const STATS_KEY = "stats:visitors";
const DEFAULT_PROJECT_ID = "cursor-curse-by-lorapok";

export const DEFAULT_STATS = {
  websiteVisits: 0,
  packageClicks: {
    ovsx: 0,
    vscode: 0,
    github: 0,
    vsix: 0,
    npm: 0,
    openvsxDuplicate: 0,
  },
  totalEngagement: 0,
  updatedAt: null,
};

export const ALLOWED_CHANNELS = new Set([
  "website",
  "ovsx",
  "vscode",
  "github",
  "vsix",
  "npm",
  "openvsxDuplicate",
]);

function parseFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("stringValue" in value) return value.stringValue;
  if ("mapValue" in value) {
    const out = {};
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) {
      out[k] = parseFirestoreValue(v);
    }
    return out;
  }
  return null;
}

/**
 * Public Firestore REST read of `stats/visitors` (rules allow anonymous read).
 * Used to seed empty KV so we do not reset historical visit counts to zero.
 * @param {Record<string, unknown>|null|undefined} env
 */
export async function fetchFirestoreVisitorStats(env) {
  const projectId = String(
    env?.FIREBASE_PROJECT_ID ?? env?.VITE_FIREBASE_PROJECT_ID ?? DEFAULT_PROJECT_ID,
  ).trim();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stats/visitors`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const doc = await res.json();
    const fields = doc.fields ?? {};
    const websiteVisits = Number(parseFirestoreValue(fields.websiteVisits) ?? 0);
    const packageClicksRaw = parseFirestoreValue(fields.packageClicks) ?? {};
    const packageClicks = {
      ...DEFAULT_STATS.packageClicks,
      ovsx: Number(packageClicksRaw.ovsx ?? 0),
      vscode: Number(packageClicksRaw.vscode ?? 0),
      github: Number(packageClicksRaw.github ?? 0),
      vsix: Number(packageClicksRaw.vsix ?? 0),
      openvsxDuplicate: Number(packageClicksRaw.openvsxDuplicate ?? 0),
    };
    const totalEngagement =
      websiteVisits + Object.values(packageClicks).reduce((s, n) => s + (Number(n) || 0), 0);
    const updatedAt = parseFirestoreValue(fields.updatedAt) ?? null;
    return {
      websiteVisits,
      packageClicks,
      totalEngagement,
      updatedAt,
      source: "firestore",
    };
  } catch {
    return null;
  }
}

export async function readVisitorStats(env) {
  if (!env.ADMIN_KV?.get) {
    return { ...DEFAULT_STATS, packageClicks: { ...DEFAULT_STATS.packageClicks } };
  }
  try {
    const raw = await env.ADMIN_KV.get(STATS_KEY);
    if (!raw) {
      return { ...DEFAULT_STATS, packageClicks: { ...DEFAULT_STATS.packageClicks } };
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATS,
      ...parsed,
      packageClicks: { ...DEFAULT_STATS.packageClicks, ...(parsed.packageClicks ?? {}) },
    };
  } catch {
    return { ...DEFAULT_STATS, packageClicks: { ...DEFAULT_STATS.packageClicks } };
  }
}

/**
 * Prefer the richer of KV vs Firestore so empty KV does not wipe historical totals.
 * @param {Record<string, unknown>|null|undefined} env
 */
export async function readVisitorStatsMerged(env) {
  const kv = await readVisitorStats(env);
  const firestore = await fetchFirestoreVisitorStats(env);
  if (!firestore) return { ...kv, source: kv.updatedAt ? "kv" : "kv-empty" };

  const kvVisits = Number(kv.websiteVisits ?? 0);
  const fsVisits = Number(firestore.websiteVisits ?? 0);
  if (kvVisits >= fsVisits && kv.updatedAt) {
    return { ...kv, source: "kv" };
  }
  if (fsVisits > kvVisits) {
    return { ...firestore, source: "firestore" };
  }
  return {
    ...kv,
    source: kv.updatedAt ? "kv" : firestore.updatedAt ? "firestore" : "kv-empty",
  };
}

export async function incrementVisitorStats(env, channel) {
  let stats = await readVisitorStats(env);
  // Seed from Firestore once so the first KV write does not reset ~276 historical visits to 1.
  if (!stats.updatedAt || Number(stats.websiteVisits ?? 0) === 0) {
    const seed = await fetchFirestoreVisitorStats(env);
    if (seed && Number(seed.websiteVisits ?? 0) > Number(stats.websiteVisits ?? 0)) {
      stats = {
        ...stats,
        ...seed,
        packageClicks: { ...DEFAULT_STATS.packageClicks, ...(seed.packageClicks ?? {}) },
      };
    }
  }

  if (channel === "website") {
    stats.websiteVisits = (stats.websiteVisits ?? 0) + 1;
  } else if (ALLOWED_CHANNELS.has(channel)) {
    stats.packageClicks[channel] = (stats.packageClicks[channel] ?? 0) + 1;
  } else {
    return stats;
  }
  stats.totalEngagement =
    (stats.websiteVisits ?? 0) +
    Object.values(stats.packageClicks ?? {}).reduce((s, n) => s + (Number(n) || 0), 0);
  stats.updatedAt = new Date().toISOString();
  stats.source = "kv";
  if (env.ADMIN_KV?.put) {
    await putKvJsonSafe(env, STATS_KEY, stats);
  }
  return stats;
}

export { STATS_KEY };
