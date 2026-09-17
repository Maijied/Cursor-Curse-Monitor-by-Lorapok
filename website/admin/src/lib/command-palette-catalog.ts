import { APP_ROUTES } from "../routes";
import { API_CATALOG } from "./api-catalog";
import { canAccessFeature, SETTINGS_TAB_PERMISSIONS } from "./nav-permissions";
import type { SettingsTabId } from "../components/ui/settings-tab-storage";
import { fuzzyBest } from "./fuzzy-match";

export type CommandPaletteGroup = "Navigation" | "Settings" | "API" | "Docs" | "Tasks";

export type CommandPaletteItem = {
  id: string;
  group: CommandPaletteGroup;
  label: string;
  description?: string;
  keywords: string[];
  /** In-app path (may include query/hash). */
  path?: string;
  /** External URL (opens in new tab). */
  href?: string;
  /** Persist settings tab before navigate. */
  settingsTab?: SettingsTabId;
  permission?: string | string[];
};

const SETTINGS_TABS: { id: SettingsTabId; label: string; keywords?: string }[] = [
  { id: "general", label: "General", keywords: "theme health infrastructure" },
  { id: "profile", label: "Profile", keywords: "display name pin" },
  { id: "mail", label: "Mail", keywords: "outbound transport checklist" },
  { id: "identities", label: "Mail aliases", keywords: "email identities lorapok routing" },
  { id: "resend", label: "Resend", keywords: "smtp api from" },
  { id: "testmail", label: "Testmail", keywords: "e2e probe inbox" },
  { id: "discord", label: "Discord", keywords: "webhook community github-log deployment" },
  { id: "social", label: "Social", keywords: "gallery publish" },
  { id: "seo", label: "SEO", keywords: "meta sitemap" },
  { id: "firebase", label: "Firebase", keywords: "auth google" },
  { id: "github", label: "GitHub", keywords: "actions token webhook" },
  { id: "cloudflare", label: "Cloudflare", keywords: "pages kv workers" },
  { id: "cred-vault", label: "Cred vault", keywords: "secrets sync gpg" },
  { id: "marketplace", label: "Marketplace", keywords: "openvsx vsce" },
  { id: "automation", label: "Automation", keywords: "cron schedules reindex" },
  { id: "cloud-dev", label: "Cloud dev", keywords: "environments" },
  { id: "services", label: "Services", keywords: "integrations hub" },
];

/** Docs TOC ids/titles — keep in sync with Docs.tsx SECTIONS. */
export const DOC_TOC: { id: string; title: string }[] = [
  { id: "architecture", title: "Architecture" },
  { id: "deploy-rollback", title: "Deploy & Rollback" },
  { id: "notices", title: "Notices" },
  { id: "analytics", title: "Analytics" },
  { id: "opt-in-heartbeat", title: "Opt-in heartbeat" },
  { id: "quit-then-write", title: "Quit-then-write" },
  { id: "discussions-github", title: "Discussions (GitHub)" },
  { id: "usage-dual-signals", title: "Usage dual signals" },
  { id: "admin-button", title: "Admin button" },
  { id: "mail", title: "Mail" },
  { id: "team-invite", title: "Team invite" },
  { id: "kv-firebase", title: "KV & Firebase" },
  { id: "credentials", title: "Credentials" },
  { id: "social", title: "Social" },
];

const TASK_ITEMS: Omit<CommandPaletteItem, "group">[] = [
  {
    id: "task-admin-01",
    label: "ADMIN-01 — Global search (⌘K)",
    description: "Command palette across nav, settings, API, docs, tasks",
    keywords: ["admin-01", "command palette", "search"],
    href: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/191",
    permission: "settings.read",
  },
  {
    id: "task-admin-02",
    label: "ADMIN-02 — Admin UX polish",
    description: "Empty states, mobile sidebar, contextual help",
    keywords: ["admin-02", "ux", "polish"],
    href: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/192",
    permission: "settings.read",
  },
  {
    id: "task-web-07",
    label: "WEB-07 — System topology",
    description: "Animated CI/CD + architecture diagrams",
    keywords: ["web-07", "topology", "diagram"],
    href: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/194",
    path: "/dashboard/architecture",
    permission: "settings.read",
  },
  {
    id: "task-analytics-01",
    label: "ANALYTICS-01 — Service analytics hub",
    description: "Operator metrics across Cloudflare, GitHub, Resend, marketplaces",
    keywords: ["analytics-01", "metrics", "reports"],
    path: "/dashboard/reports",
    href: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/166",
    permission: "settings.read",
  },
  {
    id: "task-logs-01",
    label: "LOGS-01 — Unified logs explorer",
    description: "Structured logs, ACL filter, export",
    keywords: ["logs-01", "explorer"],
    path: "/dashboard/logs",
    href: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/168",
    permission: "logs.read",
  },
];

/**
 * Build ACL-filtered command palette items.
 */
export function buildCommandPaletteItems(
  hasPermission: (permission: string) => boolean
): CommandPaletteItem[] {
  const items: CommandPaletteItem[] = [];

  for (const route of APP_ROUTES) {
    if (!canAccessFeature(hasPermission, route.permission)) continue;
    items.push({
      id: `nav-${route.path}`,
      group: "Navigation",
      label: route.label,
      description: route.path,
      keywords: [route.label, route.path.replace(/\//g, " ")],
      path: route.path,
      permission: route.permission,
    });
  }

  for (const tab of SETTINGS_TABS) {
    if (!canAccessFeature(hasPermission, SETTINGS_TAB_PERMISSIONS[tab.id])) continue;
    items.push({
      id: `settings-${tab.id}`,
      group: "Settings",
      label: `Settings → ${tab.label}`,
      description: `Open the ${tab.label} settings tab`,
      keywords: [tab.label, tab.id, "settings", ...(tab.keywords?.split(" ") ?? [])],
      path: `/dashboard/settings?tab=${tab.id}`,
      settingsTab: tab.id,
      permission: SETTINGS_TAB_PERMISSIONS[tab.id],
    });
  }

  if (canAccessFeature(hasPermission, "integrations.read")) {
    for (const entry of API_CATALOG) {
      items.push({
        id: `api-${entry.id}`,
        group: "API",
        label: `${entry.method} ${entry.path}`,
        description: entry.description,
        keywords: [entry.id, entry.path, entry.method, entry.group, entry.description],
        path: `/dashboard/api-explorer#${entry.id}`,
        permission: "integrations.read",
      });
    }
  }

  if (canAccessFeature(hasPermission, "settings.read")) {
    for (const doc of DOC_TOC) {
      items.push({
        id: `docs-${doc.id}`,
        group: "Docs",
        label: doc.title,
        description: `Docs → ${doc.title}`,
        keywords: [doc.title, doc.id, "docs", "documentation"],
        path: `/dashboard/docs#${doc.id}`,
        permission: "settings.read",
      });
    }
  }

  for (const task of TASK_ITEMS) {
    if (!canAccessFeature(hasPermission, task.permission)) continue;
    items.push({ ...task, group: "Tasks" });
  }

  return items;
}

export type RankedCommandItem = CommandPaletteItem & { score: number };

export function rankCommandPaletteItems(
  items: CommandPaletteItem[],
  query: string
): RankedCommandItem[] {
  const q = query.trim();
  if (!q) {
    return items.slice(0, 40).map((item) => ({ ...item, score: 1 }));
  }
  return items
    .map((item) => ({
      ...item,
      score: fuzzyBest(q, [item.label, item.description ?? "", ...item.keywords]),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 50);
}
