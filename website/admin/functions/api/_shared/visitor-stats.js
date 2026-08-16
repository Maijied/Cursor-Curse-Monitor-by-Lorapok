const STATS_KEY = "stats:visitors";

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

export async function incrementVisitorStats(env, channel) {
  const stats = await readVisitorStats(env);
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
  if (env.ADMIN_KV?.put) {
    await env.ADMIN_KV.put(STATS_KEY, JSON.stringify(stats));
  }
  return stats;
}

export { STATS_KEY };
