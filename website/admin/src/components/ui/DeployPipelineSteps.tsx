import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Circle, Loader2, Minus, X } from "lucide-react";
import {
  getJobStepState,
  getPipelineActiveIndex,
  getPipelineSummary,
  shortJobName,
  sortWorkflowJobs,
  stepStateLabel,
  type StepState,
  type WorkflowJob,
} from "../../lib/workflow-jobs";

export type PipelineJob = WorkflowJob;

export { getJobStepState, getPipelineActiveIndex };

type DeployPipelineStepsProps = {
  jobs: PipelineJob[];
};

function StateIcon({ state }: { state: StepState }) {
  if (state === "success") return <Check size={16} strokeWidth={2.5} aria-hidden="true" />;
  if (state === "failed") return <X size={16} strokeWidth={2.5} aria-hidden="true" />;
  if (state === "skipped") return <Minus size={14} aria-hidden="true" />;
  if (state === "active") return <Loader2 size={16} className="animate-spin" aria-hidden="true" />;
  return <Circle size={12} strokeWidth={2} aria-hidden="true" />;
}

function stateTone(state: StepState, isCurrent: boolean): string {
  if (state === "success") {
    return "border-[color-mix(in_srgb,var(--color-neon)_30%,transparent)] text-[var(--color-neon)]";
  }
  if (state === "failed") {
    return "border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] text-[var(--color-danger)]";
  }
  if (state === "skipped") {
    return "border-[var(--color-border)] text-[var(--color-muted)] opacity-70";
  }
  if (isCurrent) {
    return "border-[color-mix(in_srgb,var(--color-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)]";
  }
  return "border-[var(--color-border)] text-[var(--color-muted)]";
}

function StepRow({
  job,
  state,
  isCurrent,
  stepNumber,
}: {
  job: WorkflowJob;
  state: StepState;
  isCurrent: boolean;
  stepNumber: number;
}) {
  const shortName = shortJobName(job.name);
  const showFullName = shortName !== job.name;

  return (
    <li
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-300 ${stateTone(state, isCurrent)} ${
        isCurrent ? "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_18%,transparent)]" : "bg-[var(--color-bg-base)]/40"
      }`}
      aria-current={isCurrent ? "step" : undefined}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${stateTone(state, isCurrent)}`}
      >
        <StateIcon state={state} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-sm ${isCurrent ? "font-semibold text-[var(--color-text)]" : "font-medium text-[var(--color-text)]"}`}>
            <span className="text-[var(--color-muted)] font-[family-name:var(--font-mono)] text-xs mr-2">
              {stepNumber}
            </span>
            {shortName}
          </p>
          <span className="text-[10px] font-semibold uppercase tracking-wide">{stepStateLabel(state)}</span>
        </div>
        {showFullName ? <p className="mt-0.5 text-xs text-[var(--color-muted)]">{job.name}</p> : null}
      </div>
    </li>
  );
}

export default function DeployPipelineSteps({ jobs: rawJobs }: DeployPipelineStepsProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  const jobs = useMemo(() => sortWorkflowJobs(rawJobs), [rawJobs]);
  const summary = useMemo(() => getPipelineSummary(jobs), [jobs]);
  const activeIndex = useMemo(() => getPipelineActiveIndex(jobs), [jobs]);

  const completedJobs = useMemo(
    () => jobs.filter((job) => getJobStepState(job) === "success"),
    [jobs],
  );
  const hideCompleted =
    completedJobs.length > 2 && !showCompleted && summary.phase !== "done" && summary.phase !== "error";

  if (!jobs.length || !summary) return null;

  const progressPct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  return (
    <div className="deploy-pipeline rounded-2xl border border-[color-mix(in_srgb,var(--color-accent)_22%,transparent)] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--color-bg-elevated)_92%,transparent),color-mix(in_srgb,var(--color-bg-base)_98%,transparent))] p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-2)]">
              {summary.phase === "done"
                ? "Complete"
                : summary.phase === "error"
                  ? "Needs attention"
                  : "Now running"}
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">{summary.title}</p>
            <p className="mt-0.5 text-sm text-[var(--color-muted)]">{summary.subtitle}</p>
          </div>
          <div className="text-right text-xs font-[family-name:var(--font-mono)] text-[var(--color-muted)]">
            <p>
              Step {Math.min(summary.activeIndex + 1, summary.total)} / {summary.total}
            </p>
            <p className="mt-0.5">{summary.completed} done</p>
          </div>
        </div>

        <div className="space-y-1.5" aria-hidden="true">
          <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-border)_80%,transparent)]">
            <div
              className="deploy-pipeline-progress h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-neon)] transition-[width] duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[11px] text-[var(--color-muted)]">{progressPct}% of workflow jobs finished</p>
        </div>
      </div>

      {hideCompleted ? (
        <button
          type="button"
          onClick={() => setShowCompleted(true)}
          className="mb-3 flex w-full items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-left text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <ChevronRight size={16} aria-hidden="true" />
          Show {completedJobs.length} completed earlier step{completedJobs.length === 1 ? "" : "s"}
        </button>
      ) : null}

      {showCompleted && completedJobs.length > 2 ? (
        <button
          type="button"
          onClick={() => setShowCompleted(false)}
          className="mb-3 flex w-full items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-left text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <ChevronDown size={16} aria-hidden="true" />
          Hide completed steps
        </button>
      ) : null}

      <ol className="space-y-2" aria-label="Deployment pipeline steps">
        {jobs.map((job, index) => {
          const state = getJobStepState(job);
          if (hideCompleted && state === "success" && index < activeIndex) {
            return null;
          }
          const isCurrent = index === activeIndex && summary.phase !== "done" && summary.phase !== "error";
          return (
            <StepRow
              key={job.id}
              job={job}
              state={state}
              isCurrent={isCurrent}
              stepNumber={index + 1}
            />
          );
        })}
      </ol>
    </div>
  );
}
