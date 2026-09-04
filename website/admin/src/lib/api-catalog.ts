export type ApiAuthMode = "public" | "admin" | "cron";

export type ApiCatalogGroup =
  | "Public"
  | "Stats"
  | "Community"
  | "Integrations"
  | "Admin"
  | "Deploy";

export type ApiCatalogEntry = {
  id: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  auth: ApiAuthMode;
  description: string;
  group: ApiCatalogGroup;
  /** Safe to include in "Test all" without side effects */
  safeProbe?: boolean;
  sampleBody?: Record<string, unknown>;
};

export const API_CATALOG: ApiCatalogEntry[] = [
  { id: "health", path: "/health", method: "GET", auth: "public", group: "Public", description: "GitHub + env health check", safeProbe: true },
  { id: "sync-status", path: "/sync/status", method: "GET", auth: "admin", group: "Admin", description: "Aggregated sync health (GitHub, mail, live stats cache)", safeProbe: true },
  { id: "site-data", path: "/site-data", method: "GET", auth: "public", group: "Public", description: "Live marketing site-data.json proxy", safeProbe: true },
  { id: "notice-get", path: "/notice", method: "GET", auth: "public", group: "Public", description: "Active public development notice", safeProbe: true },
  { id: "notice-post", path: "/notice", method: "POST", auth: "admin", group: "Public", description: "Publish the active development notice" },
  { id: "notice-put", path: "/notice", method: "PUT", auth: "admin", group: "Public", description: "Replace the active development notice" },
  { id: "notice-delete", path: "/notice", method: "DELETE", auth: "admin", group: "Public", description: "Disable the active development notice" },
  { id: "subscribe", path: "/subscribe", method: "POST", auth: "public", group: "Public", description: "Newsletter subscribe endpoint probe", safeProbe: true, sampleBody: { email: "probe@lorapok.tech", probe: true } },
  { id: "site-config", path: "/site-config", method: "GET", auth: "public", group: "Public", description: "Public subscribe, mail, and cursor index policy (no secrets)", safeProbe: true },
  { id: "feedback", path: "/feedback", method: "POST", auth: "public", group: "Public", description: "User feedback → Discord + admin logs", safeProbe: true, sampleBody: { probe: true } },
  { id: "analytics-stats", path: "/analytics/stats", method: "GET", auth: "public", group: "Stats", description: "Website visits + package clicks", safeProbe: true },
  { id: "analytics-visit", path: "/analytics/visit", method: "POST", auth: "public", group: "Stats", description: "Record a website visit or package click" },
  { id: "stats-readme-svg", path: "/stats/readme.svg", method: "GET", auth: "public", group: "Stats", description: "Live README download chart (SVG)", safeProbe: true },
  { id: "stats-badge", path: "/stats/badge.json", method: "GET", auth: "public", group: "Stats", description: "Shields.io badge JSON for README downloads", safeProbe: true },
  { id: "stats-badge-shields-total", path: "/stats/shields/total.svg", method: "GET", auth: "public", group: "Stats", description: "Live Shields.io badge JSON (total downloads)", safeProbe: true },
  { id: "stats-badge-shields-openvsx", path: "/stats/shields/openvsx.svg", method: "GET", auth: "public", group: "Stats", description: "Live Shields.io badge JSON (Open VSX canonical)", safeProbe: true },
  { id: "stats-badge-shields-openvsx-total", path: "/stats/shields/openvsx-total.svg", method: "GET", auth: "public", group: "Stats", description: "Live Shields.io badge JSON (Open VSX total)", safeProbe: true },
  { id: "stats-badge-shields-vscode", path: "/stats/shields/vscode.svg", method: "GET", auth: "public", group: "Stats", description: "Live Shields.io badge JSON (VS Code Marketplace)", safeProbe: true },
  { id: "usage-stats", path: "/usage/stats", method: "GET", auth: "admin", group: "Stats", description: "Opt-in extension heartbeat stats", safeProbe: true },
  { id: "usage-ping", path: "/usage/ping", method: "POST", auth: "public", group: "Stats", description: "Anonymous extension heartbeat ping" },
  { id: "community-config-get", path: "/community/config", method: "GET", auth: "public", group: "Community", description: "Community discussions config", safeProbe: true },
  { id: "community-config-put", path: "/community/config", method: "PUT", auth: "admin", group: "Community", description: "Update community discussions config" },
  { id: "discussions-get", path: "/discussions", method: "GET", auth: "admin", group: "Community", description: "GitHub Discussions feed", safeProbe: true },
  { id: "discussions-post", path: "/discussions", method: "POST", auth: "admin", group: "Community", description: "Create a GitHub Discussion" },
  { id: "subscribers", path: "/subscribers", method: "GET", auth: "admin", group: "Community", description: "Opt-in release update email list", safeProbe: true },
  { id: "subscribers-broadcast", path: "/subscribers/broadcast", method: "POST", auth: "admin", group: "Community", description: "Email all subscribers (notice template)" },
  { id: "discord-config", path: "/integrations/discord/config", method: "GET", auth: "admin", group: "Integrations", description: "Discord deployment-status webhook settings", safeProbe: true },
  { id: "discord-config-put", path: "/integrations/discord/config", method: "PUT", auth: "admin", group: "Integrations", description: "Save Discord deployment, feedback, or community webhook URLs" },
  { id: "discord-deployment", path: "/integrations/discord/deployment", method: "POST", auth: "admin", group: "Integrations", description: "Send a deployment status notification to Discord" },
  { id: "discord-feedback", path: "/integrations/discord/feedback", method: "POST", auth: "admin", group: "Integrations", description: "Send a user-feedback card to the feedback Discord webhook" },
  { id: "discord-community", path: "/integrations/discord/community", method: "POST", auth: "admin", group: "Integrations", description: "Send a community announcement test post to the community Discord webhook" },
  { id: "mail-config", path: "/integrations/mail/config", method: "GET", auth: "admin", group: "Integrations", description: "Outbound mail identities and transport status", safeProbe: true },
  { id: "mail-config-put", path: "/integrations/mail/config", method: "PUT", auth: "admin", group: "Integrations", description: "Save outbound mail identities and routing preferences" },
  { id: "mail-status", path: "/integrations/mail/status", method: "GET", auth: "admin", group: "Integrations", description: "Mail setup readiness checklist aggregate", safeProbe: true },
  { id: "mail-sync", path: "/integrations/mail/sync", method: "POST", auth: "admin", group: "Integrations", description: "Dispatch deploy-infra to repair outbound mail (relay + verify + Pages deploy)" },
  { id: "mail-testmail", path: "/integrations/mail/testmail", method: "GET", auth: "admin", group: "Integrations", description: "Poll testmail.app inbox by tag for Mailbox E2E probe", safeProbe: true },
  { id: "subscribe-config", path: "/integrations/subscribe/config", method: "GET", auth: "admin", group: "Integrations", description: "Subscribe prompt + mail fallback settings", safeProbe: true },
  { id: "subscribe-config-put", path: "/integrations/subscribe/config", method: "PUT", auth: "admin", group: "Integrations", description: "Save subscribe prompt Discord fallback and visibility" },
  { id: "cursor-index-config", path: "/integrations/cursor-index/config", method: "GET", auth: "admin", group: "Integrations", description: "Cursor index policy (reindex, export/import limits, lookback)", safeProbe: true },
  { id: "cursor-index-config-put", path: "/integrations/cursor-index/config", method: "PUT", auth: "admin", group: "Integrations", description: "Save cursor index policy and record limits" },
  { id: "reindex-config", path: "/integrations/reindex/config", method: "GET", auth: "admin", group: "Integrations", description: "Legacy reindex policy alias (use cursor-index)", safeProbe: true },
  { id: "reindex-config-put", path: "/integrations/reindex/config", method: "PUT", auth: "admin", group: "Integrations", description: "Legacy reindex save alias (use cursor-index)" },
  { id: "stats-refresh-config", path: "/integrations/stats-refresh/config", method: "GET", auth: "admin", group: "Integrations", description: "Live download stats refresh settings", safeProbe: true },
  { id: "stats-refresh-config-put", path: "/integrations/stats-refresh/config", method: "PUT", auth: "admin", group: "Integrations", description: "Save live stats refresh interval and enable flag" },
  { id: "cron-jobs-config", path: "/integrations/cron-jobs/config", method: "GET", auth: "admin", group: "Integrations", description: "Unified cron schedules (stats refresh + Discord digest + GitHub read-only)", safeProbe: true },
  { id: "cron-jobs-config-put", path: "/integrations/cron-jobs/config", method: "PUT", auth: "admin", group: "Integrations", description: "Save managed Cloudflare cron intervals and flags" },
  { id: "discord-digest-test", path: "/integrations/discord/digest/test", method: "POST", auth: "admin", group: "Integrations", description: "Send Discord download digest now (deployment webhook)" },
  { id: "stats-refresh-now", path: "/stats/refresh", method: "POST", auth: "admin", group: "Integrations", description: "Manually refresh live marketplace download stats" },
  { id: "stats-refresh-cron", path: "/cron/stats-refresh", method: "POST", auth: "cron", group: "Integrations", description: "Cron hook for live stats refresh (CRON_SECRET)" },
  { id: "discord-digest-cron", path: "/cron/discord-digest", method: "POST", auth: "cron", group: "Integrations", description: "Cron hook for Discord download digest (CRON_SECRET)" },
  { id: "resend-vault-bootstrap-cron", path: "/cron/resend-vault-bootstrap", method: "GET", auth: "cron", group: "Integrations", description: "Cron hook to read RESEND_API_KEY for cred vault sync (CRON_SECRET)" },
  { id: "notices", path: "/notices", method: "GET", auth: "admin", group: "Admin", description: "Admin notices catalog", safeProbe: true },
  { id: "notices-post", path: "/notices", method: "POST", auth: "admin", group: "Admin", description: "Create a catalog notice" },
  { id: "notices-put", path: "/notices", method: "PUT", auth: "admin", group: "Admin", description: "Update a catalog notice" },
  { id: "notices-delete", path: "/notices", method: "DELETE", auth: "admin", group: "Admin", description: "Delete a catalog notice" },
  { id: "tags", path: "/tags", method: "GET", auth: "admin", group: "Admin", description: "GitHub release tags with live/suggested metadata", safeProbe: true },
  { id: "releases", path: "/releases", method: "GET", auth: "admin", group: "Admin", description: "GitHub releases + VSIX assets", safeProbe: true },
  { id: "workflows", path: "/workflows/runs", method: "GET", auth: "admin", group: "Admin", description: "Recent GitHub Actions runs", safeProbe: true },
  { id: "workflow-run-logs", path: "/workflows/run-logs?run_id=1", method: "GET", auth: "admin", group: "Admin", description: "GitHub Actions run logs (requires run_id)" },
  { id: "activity", path: "/activity?page=1&limit=5", method: "GET", auth: "admin", group: "Admin", description: "Authenticated API request log", safeProbe: true },
  { id: "logs", path: "/logs?page=1&limit=5", method: "GET", auth: "admin", group: "Admin", description: "Merged API, mailbox, and system logs", safeProbe: true },
  { id: "mailbox-get", path: "/mailbox?page=1&limit=5", method: "GET", auth: "admin", group: "Admin", description: "Outbound mailbox messages", safeProbe: true },
  { id: "mailbox-post", path: "/mailbox", method: "POST", auth: "admin", group: "Admin", description: "Send or compose mailbox mail" },
  { id: "admins-get", path: "/admins", method: "GET", auth: "admin", group: "Admin", description: "Allowed admin emails (master only)", safeProbe: true },
  { id: "admins-post", path: "/admins", method: "POST", auth: "admin", group: "Admin", description: "Add or remove an admin email" },
  { id: "marketplace-sync", path: "/marketplace/sync", method: "GET", auth: "admin", group: "Admin", description: "Open VSX + VS Code sync status", safeProbe: true },
  { id: "version-plan", path: "/version/plan?bump=patch&mode=release", method: "GET", auth: "admin", group: "Admin", description: "Next version plan for release or rollback", safeProbe: true },
  { id: "deploy", path: "/deploy", method: "POST", auth: "admin", group: "Deploy", description: "Publish an existing git tag to marketplaces" },
  { id: "deploy-infra", path: "/deploy-infra", method: "POST", auth: "admin", group: "Deploy", description: "Deploy admin Pages and/or marketing website" },
  { id: "release", path: "/release", method: "POST", auth: "admin", group: "Deploy", description: "Cut a new version and publish" },
  { id: "rollback", path: "/rollback", method: "POST", auth: "admin", group: "Deploy", description: "Roll back to a previous published tag" },
];

export const API_CATALOG_GROUPS: ApiCatalogGroup[] = [
  "Public",
  "Stats",
  "Community",
  "Integrations",
  "Admin",
  "Deploy",
];
