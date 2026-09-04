import type { SettingsTabId } from "../components/ui/SettingsTabNav";

export type NavPermission = string | string[];

/** True when any listed permission is granted (master bypass handled by hasPermission). */
export function canAccessFeature(
  hasPermission: (permission: string) => boolean,
  required?: NavPermission
): boolean {
  if (!required) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.some((p) => hasPermission(p));
}

/** Minimum permission to view a Settings tab. */
export const SETTINGS_TAB_PERMISSIONS: Record<SettingsTabId, NavPermission> = {
  general: "settings.read",
  profile: "profile.write",
  mail: "settings.read",
  identities: "settings.read",
  resend: "integrations.read",
  testmail: "integrations.read",
  discord: "integrations.read",
  firebase: "integrations.read",
  github: "integrations.read",
  cloudflare: "integrations.read",
  "cred-vault": "secrets.manage",
  marketplace: "settings.read",
  automation: "settings.read",
  "cloud-dev": "settings.read",
  services: "settings.read",
};

export function visibleSettingsTabs(
  hasPermission: (permission: string) => boolean
): SettingsTabId[] {
  return (Object.keys(SETTINGS_TAB_PERMISSIONS) as SettingsTabId[]).filter((id) =>
    canAccessFeature(hasPermission, SETTINGS_TAB_PERMISSIONS[id])
  );
}
