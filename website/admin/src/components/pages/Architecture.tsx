import { useState } from "react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import ArchitectureMermaid from "../ui/ArchitectureMermaid";
import {
  ARCHITECTURE_VIEWS,
  ARCHITECTURE_VIEW_KEYS,
} from "../../../../shared/architecture-diagrams.mjs";

type ViewKey = (typeof ARCHITECTURE_VIEW_KEYS)[number];

export default function Architecture() {
  const [activeView, setActiveView] = useState<ViewKey>(ARCHITECTURE_VIEW_KEYS[0] as ViewKey);
  const view = ARCHITECTURE_VIEWS[activeView];

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Architecture"
        description="End-to-end topology — data flow, Production Deployment pipeline, edge-case guards, and scheduled jobs with Discord."
      />

      <Card>
        <p className="text-sm text-[var(--color-muted)] mb-6 max-w-3xl">
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
          className="architecture-tabs flex flex-wrap gap-2 mb-4"
          role="tablist"
          aria-label="Architecture diagram views"
        >
          {ARCHITECTURE_VIEW_KEYS.map((key: string) => {
            const item = ARCHITECTURE_VIEWS[key as ViewKey];
            const active = key === activeView;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-300 ${
                  active
                    ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-accent)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-white/5"
                }`}
                onClick={() => setActiveView(key as ViewKey)}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {view ? (
          <div role="tabpanel" className="space-y-4 animate-fade-slide-up">
            <p className="text-sm text-[var(--color-muted)] max-w-3xl">{view.description}</p>
            <ArchitectureMermaid key={activeView} diagram={view.diagram} />
          </div>
        ) : null}

      </Card>
    </div>
  );
}
