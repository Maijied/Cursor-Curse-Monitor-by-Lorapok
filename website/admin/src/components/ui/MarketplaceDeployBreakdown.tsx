import { Check, Circle, Github, Globe, Loader2, Minus, Package, X } from "lucide-react";
import {
  countMarketplaceProgress,
  extractMarketplaceTargets,
  findMarketplaceJob,
  type MarketplaceTarget,
  type StepState,
  type WorkflowJob,
} from "../../lib/workflow-jobs";

type MarketplaceDeployBreakdownProps = {
  jobs: WorkflowJob[];
  targetTag?: string;
};

function TargetIcon({ id }: { id: string }) {
  if (id === "github-release") return <Github size={16} aria-hidden="true" />;
  if (id.startsWith("ovsx")) return <Globe size={16} aria-hidden="true" />;
  if (id === "amo") {
    return (
      <span className="text-xs font-bold leading-none" aria-hidden="true">
        Fx
      </span>
    );
  }
  return <Package size={16} aria-hidden="true" />;
}

function stateLabel(state: StepState): string {
  if (state === "success") return "Published";
  if (state === "failed") return "Failed";
  if (state === "active") return "Publishing";
  if (state === "skipped") return "Skipped";
  return "Queued";
}

function StateIcon({ state }: { state: StepState }) {
  if (state === "success") return <Check size={14} strokeWidth={2.5} aria-hidden="true" />;
  if (state === "failed") return <X size={14} strokeWidth={2.5} aria-hidden="true" />;
  if (state === "active") return <Loader2 size={14} className="animate-spin" aria-hidden="true" />;
  if (state === "skipped") return <Minus size={14} aria-hidden="true" />;
  return <Circle size={12} strokeWidth={2} aria-hidden="true" />;
}

function targetTone(state: StepState): string {
  if (state === "success") {
    return "border-[color-mix(in_srgb,var(--color-neon)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-neon)_8%,transparent)] text-[var(--color-neon)]";
  }
  if (state === "failed") {
    return "border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] text-[var(--color-danger)]";
  }
  if (state === "active") {
    return "border-[color-mix(in_srgb,var(--color-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)]";
  }
  if (state === "skipped") {
    return "border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-muted)] opacity-70";
  }
  return "border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-muted)]";
}

function TargetRow({ target, isLast }: { target: MarketplaceTarget; isLast: boolean }) {
  return (
    <li className="relative flex gap-3">
      {!isLast ? (
        <span
          className="absolute left-[1.125rem] top-9 bottom-0 w-px bg-[color-mix(in_srgb,var(--color-border)_85%,transparent)]"
          aria-hidden="true"
        />
      ) : null}
      <div
        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${targetTone(target.state)}`}
      >
        <TargetIcon id={target.id} />
      </div>
      <div className={`min-w-0 flex-1 pb-4 ${isLast ? "pb-0" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">{target.label}</p>
            <p className="text-xs text-[var(--color-muted)]">{target.detail}</p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${targetTone(target.state)}`}
          >
            <StateIcon state={target.state} />
            {stateLabel(target.state)}
          </span>
        </div>
      </div>
    </li>
  );
}

export default function MarketplaceDeployBreakdown({ jobs, targetTag }: MarketplaceDeployBreakdownProps) {
  const marketplaceJob = findMarketplaceJob(jobs);
  const targets = extractMarketplaceTargets(marketplaceJob);
  if (!targets.length) return null;

  const progress = countMarketplaceProgress(targets);
  const jobState = marketplaceJob?.conclusion ?? marketplaceJob?.status ?? "pending";

  return (
    <section className="marketplace-breakdown rounded-2xl border border-[color-mix(in_srgb,var(--color-accent-2)_22%,transparent)] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-bg-elevated)_94%,transparent),color-mix(in_srgb,var(--color-bg-base)_98%,transparent))] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-2)]">
            Marketplace breakdown
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {targetTag ? (
              <>
                Publishing <span className="font-[family-name:var(--font-mono)] text-[var(--color-text)]">{targetTag}</span>{" "}
                to each store
              </>
            ) : (
              "Per-platform publish status inside Deploy to Marketplaces"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-[family-name:var(--font-mono)]">
          <span className="rounded-full border border-[color-mix(in_srgb,var(--color-neon)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-neon)_8%,transparent)] px-2 py-0.5 text-[var(--color-neon)]">
            {progress.done}/{progress.total} live
          </span>
          {progress.active > 0 ? (
            <span className="rounded-full border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] px-2 py-0.5 text-[var(--color-accent)]">
              {progress.active} running
            </span>
          ) : null}
          {progress.failed > 0 ? (
            <span className="rounded-full border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-2 py-0.5 text-[var(--color-danger)]">
              {progress.failed} failed
            </span>
          ) : null}
          <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[var(--color-muted)]">
            job: {jobState}
          </span>
        </div>
      </div>

      <ol className="space-y-0">
        {targets.map((target, index) => (
          <TargetRow key={target.id} target={target} isLast={index === targets.length - 1} />
        ))}
      </ol>
    </section>
  );
}
