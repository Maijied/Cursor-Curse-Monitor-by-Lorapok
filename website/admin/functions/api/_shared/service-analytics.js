/**
 * ANALYTICS-01 — operator-facing service analytics hub (aggregate facade).
 * Builds a normalized card list from health probes, site-data, visitor stats, and mail quotas.
 * No secrets — only configured/ok flags and public counts.
 */

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   category: "cloudflare" | "google" | "github" | "mail" | "marketplace" | "traffic";
 *   status: "ok" | "warn" | "danger" | "unknown";
 *   summary: string;
 *   metrics: Array<{ label: string; value: string | number | null }>;
 * }} ServiceAnalyticsCard
 */

/**
 * @param {boolean | null | undefined} ok
 * @param {boolean | null | undefined} configured
 * @returns {"ok" | "warn" | "danger" | "unknown"}
 */
export function deriveServiceStatus(ok, configured) {
  if (configured === false) return "warn";
  if (ok === true) return "ok";
  if (ok === false) return "danger";
  return "unknown";
}

/**
 * @param {Record<string, unknown>} input
 * @returns {{ generatedAt: string; overall: string; cards: ServiceAnalyticsCard[] }}
 */
export function buildServiceAnalyticsHub(input) {
  const generatedAt = typeof input.generatedAt === "string" ? input.generatedAt : new Date().toISOString();
  /** @type {ServiceAnalyticsCard[]} */
  const cards = [];

  const kvConfigured = Boolean(input.adminKvConfigured);
  const r2 = /** @type {Record<string, unknown> | null} */ (input.statsR2 ?? null);
  const d1Configured = Boolean(input.adminD1Configured);
  const d1Ok = input.adminD1Ok === true;
  cards.push({
    id: "cloudflare-kv",
    label: "Cloudflare KV",
    category: "cloudflare",
    status: deriveServiceStatus(kvConfigured ? true : null, kvConfigured),
    summary: kvConfigured ? "ADMIN_KV bound" : "ADMIN_KV not bound",
    metrics: [
      { label: "Configured", value: kvConfigured ? "yes" : "no" },
      {
        label: "Quota pause",
        value: input.kvWritesPaused ? String(input.kvWritesPausedUntil ?? "paused") : "none",
      },
    ],
  });
  cards.push({
    id: "cloudflare-r2",
    label: "Cloudflare R2",
    category: "cloudflare",
    status: deriveServiceStatus(r2?.ok === true, Boolean(r2?.configured)),
    summary: r2?.configured ? (r2.ok ? "STATS_R2 reachable" : "STATS_R2 probe failed") : "STATS_R2 unbound",
    metrics: [
      { label: "Configured", value: r2?.configured ? "yes" : "no" },
      { label: "Probe", value: r2?.ok == null ? "—" : r2.ok ? "ok" : "fail" },
    ],
  });
  cards.push({
    id: "cloudflare-d1",
    label: "Cloudflare D1",
    category: "cloudflare",
    status: deriveServiceStatus(d1Ok, d1Configured),
    summary: d1Configured ? (d1Ok ? "ADMIN_D1 reachable" : String(input.adminD1Error ?? "D1 probe failed")) : "ADMIN_D1 unbound",
    metrics: [
      { label: "Configured", value: d1Configured ? "yes" : "no" },
      { label: "OK", value: d1Configured ? (d1Ok ? "yes" : "no") : "—" },
    ],
  });
  cards.push({
    id: "cloudflare-pages",
    label: "Cloudflare Pages",
    category: "cloudflare",
    status: "ok",
    summary: "Mission Control + Functions host",
    metrics: [
      { label: "Public URL", value: typeof input.adminPublicUrl === "string" ? input.adminPublicUrl : "cursor-dev.lorapok.tech" },
    ],
  });

  const firebaseConfigured = Boolean(input.firebaseConfigured);
  cards.push({
    id: "firebase",
    label: "Firebase / Google",
    category: "google",
    status: deriveServiceStatus(firebaseConfigured ? true : null, firebaseConfigured),
    summary: firebaseConfigured
      ? `Auth project ${input.firebaseProject ?? "configured"}`
      : "Firebase client config incomplete",
    metrics: [
      { label: "Project", value: typeof input.firebaseProject === "string" ? input.firebaseProject : "—" },
      { label: "Configured", value: firebaseConfigured ? "yes" : "no" },
    ],
  });

  const githubOk = input.githubOk === true;
  const githubToken = Boolean(input.githubTokenConfigured);
  cards.push({
    id: "github",
    label: "GitHub",
    category: "github",
    status: deriveServiceStatus(githubOk, githubToken || githubOk),
    summary: githubOk ? "API reachable" : githubToken ? "Token set but API check failed" : "GitHub token / API unavailable",
    metrics: [
      { label: "API", value: githubOk ? "ok" : "fail" },
      { label: "Token", value: githubToken ? "set" : "missing" },
      { label: "Open issues", value: input.githubOpenIssues ?? null },
      { label: "Stars", value: input.githubStars ?? null },
    ],
  });

  const mailConfigured = Boolean(input.mailConfigured);
  cards.push({
    id: "resend-mail",
    label: "Mail / Resend",
    category: "mail",
    status: deriveServiceStatus(mailConfigured ? true : null, mailConfigured),
    summary: mailConfigured
      ? `Transport ${input.mailTransport ?? "configured"}`
      : "Outbound mail not configured",
    metrics: [
      { label: "Transport", value: typeof input.mailTransport === "string" ? input.mailTransport : "—" },
      { label: "Resend", value: input.mailResendConfigured ? "yes" : "no" },
      { label: "Last verified", value: typeof input.mailLastVerifiedAt === "string" ? input.mailLastVerifiedAt : "—" },
      {
        label: "Resend monthly used",
        value: input.resendMonthlyUsed ?? null,
      },
    ],
  });

  const downloads = input.displayTotal;
  cards.push({
    id: "marketplace",
    label: "Marketplace downloads",
    category: "marketplace",
    status: downloads != null ? "ok" : "unknown",
    summary: downloads != null ? `${downloads} verified community downloads` : "Download totals unavailable",
    metrics: [
      { label: "Total", value: downloads ?? null },
      { label: "Sync", value: typeof input.syncStatus === "string" ? input.syncStatus : "—" },
      { label: "Package", value: typeof input.packageVersion === "string" ? input.packageVersion : "—" },
    ],
  });

  cards.push({
    id: "traffic",
    label: "Website traffic",
    category: "traffic",
    status: input.websiteVisits != null ? "ok" : "unknown",
    summary:
      input.websiteVisits != null
        ? `${input.websiteVisits} visits · ${input.totalEngagement ?? 0} engagement`
        : "Visitor stats unavailable",
    metrics: [
      { label: "Visits", value: input.websiteVisits ?? null },
      { label: "Engagement", value: input.totalEngagement ?? null },
      { label: "Source", value: typeof input.visitorSource === "string" ? input.visitorSource : "—" },
    ],
  });

  const danger = cards.filter((c) => c.status === "danger").length;
  const warn = cards.filter((c) => c.status === "warn").length;
  let overall = "online";
  if (warn > 2 || danger > 0) overall = "degraded";
  if (!githubOk && !kvConfigured) overall = "offline";

  return { generatedAt, overall, cards };
}
