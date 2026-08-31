import { useState } from "react";
import { Layers, Network, Shield, Timer } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import ArchitectureMermaid from "../ui/ArchitectureMermaid";
import {
  ARCHITECTURE_VIEWS,
  ARCHITECTURE_VIEW_KEYS,
} from "../../../../shared/architecture-diagrams.mjs";

type ViewKey = (typeof ARCHITECTURE_VIEW_KEYS)[number];

const VIEW_ICONS: Record<ViewKey, typeof Network> = {
  dataFlow: Network,
  deployPipeline: Layers,
  edgeCases: Shield,
  scheduledOps: Timer,
};

export default function Architecture() {
  const [activeView, setActiveView] = useState<ViewKey>(ARCHITECTURE_VIEW_KEYS[0] as ViewKey);
  const view = ARCHITECTURE_VIEWS[activeView];
  const ActiveIcon = VIEW_ICONS[activeView] ?? Network;

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Architecture"
        description="End-to-end topology — data flow, Production Deployment pipeline, edge-case guards, and scheduled jobs with Discord."
      />

      <Card className="architecture-page-card overflow-hidden">
        <div className="architecture-page-glow" aria-hidden="true" />
        <p className="text-sm text-[var(--color-muted)] mb-6 max-w-3xl relative">
          Interactive diagrams mirror the repository{" "}
          <a
            href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok#architecture"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent-2)] hover:underline"
          >
            README architecture
          </a>
          . Switch views to inspect deploy paths, marketplace channels, and failure guards.
        </p>

        <div
          className="architecture-tabs flex flex-wrap gap-2 mb-5 relative"
          role="tablist"
          aria-label="Architecture diagram views"
        >
          {ARCHITECTURE_VIEW_KEYS.map((key: string) => {
            const item = ARCHITECTURE_VIEWS[key as ViewKey];
            const active = key === activeView;
            const Icon = VIEW_ICONS[key as ViewKey] ?? Network;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`architecture-tab inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-300 ${
                  active
                    ? "architecture-tab--active border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] text-[var(--color-accent)] shadow-[0_0_24px_rgba(77,159,255,0.12)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-white/5 hover:border-[color-mix(in_srgb,var(--color-accent)_25%,transparent)]"
                }`}
                onClick={() => setActiveView(key as ViewKey)}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        {view ? (
          <div role="tabpanel" className="space-y-4 animate-fade-slide-up relative" key={activeView}>
            <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-base)_88%,transparent)] px-4 py-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-accent)]">
                <ActiveIcon size={18} aria-hidden="true" />
              </span>
              <p className="text-sm text-[var(--color-muted)] max-w-3xl leading-relaxed">{view.description}</p>
            </div>
            <ArchitectureMermaid diagram={view.diagram} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
