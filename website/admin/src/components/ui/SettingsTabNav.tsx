import type { SettingsTabId, SettingsTab } from "./settings-tab-storage";

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
