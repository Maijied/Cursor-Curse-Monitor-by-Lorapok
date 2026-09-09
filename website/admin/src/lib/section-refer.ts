import type { SettingsTabId } from "../components/ui/settings-tab-storage";

/** Mission Control destinations for cross-section "Go to →" links. */
export type AdminSectionId =
  | "overview"
  | "settings"
  | "deployments"
  | "mailbox"
  | "mail"
  | "logs"
  | "subscribers"
  | "api-explorer"
  | "notices"
  | "team"
  | "seo"
  | "releases"
  | "marketplace";

export type SectionReferTarget = {
  section: AdminSectionId;
  settingsTab?: SettingsTabId;
  /** Override link label (default derived from section + tab). */
  label?: string;
};

type SectionRoute = {
  path: string;
  label: string;
};

const SECTION_ROUTES: Record<AdminSectionId, SectionRoute> = {
  overview: { path: "/dashboard", label: "Overview" },
  settings: { path: "/dashboard/settings", label: "Settings" },
  deployments: { path: "/dashboard/deployments", label: "Deployments" },
  mailbox: { path: "/dashboard/mailbox", label: "Mailbox" },
  mail: { path: "/dashboard/mail", label: "Mail" },
  logs: { path: "/dashboard/logs", label: "Logs" },
  subscribers: { path: "/dashboard/subscribers", label: "Subscribers" },
  "api-explorer": { path: "/dashboard/api-explorer", label: "API Explorer" },
  notices: { path: "/dashboard/notices", label: "Notices" },
  team: { path: "/dashboard/team", label: "Team Access" },
  seo: { path: "/dashboard/seo", label: "SEO" },
  releases: { path: "/dashboard/releases", label: "Releases" },
  marketplace: { path: "/dashboard/marketplace", label: "Marketplace" },
};

const SETTINGS_TAB_LABELS: Partial<Record<SettingsTabId, string>> = {
  general: "General",
  profile: "Profile",
  mail: "Mail",
  identities: "Email identities",
  resend: "Resend",
  testmail: "testmail.app",
  discord: "Discord",
  social: "Social",
  seo: "SEO",
  firebase: "Firebase",
  github: "GitHub",
  cloudflare: "Cloudflare",
  "cred-vault": "Cred vault",
  marketplace: "Marketplace",
  automation: "Automation",
  "cloud-dev": "Cloud dev",
  services: "Services",
};

export function resolveSectionRefer(target: SectionReferTarget): {
  path: string;
  label: string;
  settingsTab?: SettingsTabId;
} {
  const route = SECTION_ROUTES[target.section];
  if (target.label) {
    return { path: route.path, label: target.label, settingsTab: target.settingsTab };
  }
  if (target.section === "settings" && target.settingsTab) {
    const tabLabel = SETTINGS_TAB_LABELS[target.settingsTab] ?? target.settingsTab;
    return { path: route.path, label: `${route.label} → ${tabLabel}`, settingsTab: target.settingsTab };
  }
  return { path: route.path, label: route.label, settingsTab: target.settingsTab };
}

/** Preset targets used across admin copy. */
export const SECTION_REFERS = {
  settingsDiscord: { section: "settings", settingsTab: "discord" } satisfies SectionReferTarget,
  settingsSocial: { section: "settings", settingsTab: "social" } satisfies SectionReferTarget,
  settingsSeo: { section: "settings", settingsTab: "seo" } satisfies SectionReferTarget,
  settingsFirebase: { section: "settings", settingsTab: "firebase" } satisfies SectionReferTarget,
  settingsMail: { section: "settings", settingsTab: "mail" } satisfies SectionReferTarget,
  settingsAutomation: { section: "settings", settingsTab: "automation" } satisfies SectionReferTarget,
  settingsServices: { section: "settings", settingsTab: "services" } satisfies SectionReferTarget,
  settingsGeneral: { section: "settings", settingsTab: "general" } satisfies SectionReferTarget,
  deployments: { section: "deployments" } satisfies SectionReferTarget,
  mailbox: { section: "mailbox" } satisfies SectionReferTarget,
  apiExplorer: { section: "api-explorer" } satisfies SectionReferTarget,
  logs: { section: "logs" } satisfies SectionReferTarget,
  subscribers: { section: "subscribers" } satisfies SectionReferTarget,
} as const;
