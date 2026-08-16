import { ArrowRight, Database, GitBranch, LayoutDashboard, Puzzle, Server } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";

const STEPS = [
  {
    id: "extension",
    title: "Extension (local)",
    icon: Puzzle,
    detail:
      "Cursor Curse Monitor runs in the IDE. Opt-in heartbeat pings and a quit-then-write local DB keep usage private on the machine.",
  },
  {
    id: "db",
    title: "Read-only local DB",
    icon: Database,
    detail:
      "Usage snapshots are written locally after quit. The extension reads Cursor session state; nothing is shared as a multi-user dashboard.",
  },
  {
    id: "cursor-api",
    title: "Cursor API",
    icon: Server,
    detail:
      "Authenticated Cursor APIs supply limits, billing cycle, and budget. Credentials never leave the user’s editor session.",
  },
  {
    id: "admin-api",
    title: "Admin APIs",
    icon: LayoutDashboard,
    detail:
      "Cloudflare Pages Functions at cursor-dev.lorapok.tech expose authenticated /api/* for deployments, notices, usage stats, and discussions.",
  },
  {
    id: "github",
    title: "GitHub Discussions",
    icon: GitBranch,
    detail:
      "Community posts can be created via GraphQL when GITHUB_TOKEN is set. Categories and polls remain GitHub-only deep links.",
  },
];

export default function Architecture() {
  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Architecture"
        description="Read-only flow from the extension through admin APIs to GitHub Discussions."
      />

      <Card>
        <p className="text-sm text-[var(--color-muted)] mb-8 max-w-2xl">
          This diagram is informational only — it does not mutate systems. Each step is a one-way read or a tightly scoped
          admin write (deploy, notice, discussion post).
        </p>

        <ol className="space-y-4" aria-label="Architecture flow">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.id}>
                <div
                  className={`flex flex-col sm:flex-row sm:items-start gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-white/[0.02] animate-fade-slide-up stagger-${Math.min(index + 1, 4)}`}
                >
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center text-xs font-[family-name:var(--font-mono)] text-[var(--color-muted)]">
                      {index + 1}
                    </span>
                    <div className="p-2.5 rounded-xl bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] border border-[color-mix(in_srgb,var(--color-accent)_25%,transparent)]">
                      <Icon size={20} className="text-[var(--color-accent)]" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[var(--color-text)] mb-1">{step.title}</h3>
                    <p className="text-sm text-[var(--color-muted)] leading-relaxed">{step.detail}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="flex justify-center py-2 text-[var(--color-muted)]" aria-hidden="true">
                    <ArrowRight size={18} className="rotate-90 sm:rotate-0 opacity-60" />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
