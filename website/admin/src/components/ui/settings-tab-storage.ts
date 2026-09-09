import type { ReactNode } from "react";

export type SettingsTabId =
  | "general"
  | "profile"
  | "mail"
  | "identities"
  | "resend"
  | "testmail"
  | "discord"
  | "social"
  | "firebase"
  | "github"
  | "cloudflare"
  | "cred-vault"
  | "marketplace"
  | "automation"
  | "cloud-dev"
  | "services";

export type SettingsTab = {
  id: SettingsTabId;
  label: string;
  icon?: ReactNode;
};

const STORAGE_KEY = "admin-settings-tab";

const ALLOWED_TABS: SettingsTabId[] = [
  "general",
  "profile",
  "mail",
  "identities",
  "resend",
  "testmail",
  "discord",
  "social",
  "firebase",
  "github",
  "cloudflare",
  "cred-vault",
  "marketplace",
  "automation",
  "cloud-dev",
  "services",
];

export function readSettingsTab(): SettingsTabId {
  const raw = localStorage.getItem(STORAGE_KEY);
  return ALLOWED_TABS.includes(raw as SettingsTabId) ? (raw as SettingsTabId) : "general";
}

export function persistSettingsTab(tab: SettingsTabId) {
  localStorage.setItem(STORAGE_KEY, tab);
}
