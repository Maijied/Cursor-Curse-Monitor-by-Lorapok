export type ApiAuthMode = "public" | "admin";

export type ApiCatalogEntry = {
  id: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  auth: ApiAuthMode;
  description: string;
  /** Safe to include in "Test all" without side effects */
  safeProbe?: boolean;
  sampleBody?: Record<string, unknown>;
};

export const API_CATALOG: ApiCatalogEntry[] = [
  { id: "health", path: "/health", method: "GET", auth: "public", description: "GitHub + env health check", safeProbe: true },
  { id: "notice-get", path: "/notice", method: "GET", auth: "public", description: "Active public development notice", safeProbe: true },
  { id: "notices", path: "/notices", method: "GET", auth: "admin", description: "Admin notices catalog", safeProbe: true },
  { id: "tags", path: "/tags", method: "GET", auth: "admin", description: "GitHub release tags with live/suggested metadata", safeProbe: true },
  { id: "releases", path: "/releases", method: "GET", auth: "admin", description: "GitHub releases + VSIX assets", safeProbe: true },
  { id: "workflows", path: "/workflows/runs", method: "GET", auth: "admin", description: "Recent GitHub Actions runs", safeProbe: true },
  { id: "activity", path: "/activity?page=1&limit=5", method: "GET", auth: "admin", description: "Authenticated API request log", safeProbe: true },
  { id: "marketplace-sync", path: "/marketplace/sync", method: "GET", auth: "admin", description: "Open VSX + VS Code sync status", safeProbe: true },
  { id: "usage-stats", path: "/usage/stats", method: "GET", auth: "admin", description: "Opt-in extension heartbeat stats", safeProbe: true },
  { id: "analytics-stats", path: "/analytics/stats", method: "GET", auth: "public", description: "Website visits + package clicks", safeProbe: true },
  { id: "community-config", path: "/community/config", method: "GET", auth: "public", description: "Community discussions config", safeProbe: true },
  { id: "discussions", path: "/discussions", method: "GET", auth: "admin", description: "GitHub Discussions feed", safeProbe: true },
  { id: "admins", path: "/admins", method: "GET", auth: "admin", description: "Allowed admin emails (master only)", safeProbe: true },
  {
    id: "subscribe",
    path: "/subscribe",
    method: "POST",
    auth: "public",
    description: "Newsletter subscribe (dry-run uses invalid email)",
    sampleBody: { email: "probe-invalid@example.com" },
  },
];
