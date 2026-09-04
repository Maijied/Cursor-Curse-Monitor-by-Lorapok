import type { ReactNode } from "react";

export type SettingsTabId =
  | "general"
  | "mail"
  | "discord"
  | "firebase"
  | "github"
  | "cloudflare"
  | "automation"
  | "cloud-dev"
  | "services";

export type SettingsTab = {
  id: SettingsTabId;
  label: string;
  icon?: ReactNode;
};

const STORAGE_KEY = "admin-settings-tab";

export function readSettingsTab(): SettingsTabId {
  const raw = localStorage.getItem(STORAGE_KEY);
  const allowed: SettingsTabId[] = [
    "general",
    "mail",
    "discord",
    "firebase",
    "github",
    "cloudflare",
    "automation",
    "cloud-dev",
    "services",
  ];
  return allowed.includes(raw as SettingsTabId) ? (raw as SettingsTabId) : "general";
}

export function persistSettingsTab(tab: SettingsTabId) {
  localStorage.setItem(STORAGE_KEY, tab);
}

type SettingsTabNavProps = {
  tabs: SettingsTab[];
  active: SettingsTabId;
  onChange: (tab: SettingsTabId) => void;
};

export default function SettingsTabNav({ tabs, active, onChange }: SettingsTabNavProps) {
  return (
    <div
      className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin"
      role="tablist"
      aria-label="Settings sections"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              selected
                ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-text)]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
