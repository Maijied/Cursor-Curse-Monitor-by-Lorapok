/** Read-only GitHub Actions schedules (not editable from Mission Control). */
export const GITHUB_CRON_JOBS = [
  {
    id: "github-seo-pipeline",
    label: "SEO & site-data refresh",
    description: "Regenerates site-data.json, SEO artifacts, badges, and sitemap on main.",
    schedule: "0 6 * * 1",
    scheduleLabel: "Mon 06:00 UTC",
    workflow: "Production Deployment · seo-pipeline",
    editable: false,
  },
  {
    id: "github-dependency-security",
    label: "Dependency security scan",
    description: "Weekly npm audit scan and optional remediate dispatch.",
    schedule: "30 7 * * 1",
    scheduleLabel: "Mon 07:30 UTC",
    workflow: "dependency-security.yml",
    editable: false,
  },
];

/** Cloudflare worker jobs managed via Settings (interval in ADMIN_KV). */
export const MANAGED_CRON_JOBS = [
  {
    id: "stats-refresh",
    label: "Live stats refresh",
    description: "Polls marketplaces and refreshes stats:live-cache, README chart, and badges.",
    workerEndpoint: "/api/cron/stats-refresh",
    intervalMin: 1,
    intervalMax: 60,
    intervalDefault: 5,
    intervalUnit: "minutes",
  },
  {
    id: "discord-digest",
    label: "Discord download digest",
    description:
      "Posts download breakdown, marketplace sync, engagement, and changelog highlights to the deployment Discord webhook.",
    workerEndpoint: "/api/cron/discord-digest",
    intervalMin: 60,
    intervalMax: 10080,
    intervalDefault: 1440,
    intervalUnit: "minutes",
  },
  {
    id: "service-usage-sync",
    label: "Service quota sync",
    description:
      "Probes Resend, Cloudflare mail relay, and REST transports; refreshes used/limit counters for Settings and broadcast fallback.",
    workerEndpoint: "/api/cron/service-usage-sync",
    intervalMin: 15,
    intervalMax: 1440,
    intervalDefault: 60,
    intervalUnit: "minutes",
  },
];
