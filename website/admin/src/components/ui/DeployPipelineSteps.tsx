import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, Loader2, Minus, X } from "lucide-react";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import {
  getJobStepState,
  getPipelineActiveIndex,
  shortJobName,
  sortWorkflowJobs,
  type StepState,
  type WorkflowJob,
} from "../../lib/workflow-jobs";

export type PipelineJob = WorkflowJob;

type DeployPipelineStepsProps = {
  jobs: PipelineJob[];
};

const TRACK_INSET_PX = 24;

function isBrowserJob(name: string): boolean {
  return /firefox|chrome|amo|browser|web-ext/i.test(name);
}

function isJobSettled(job: PipelineJob): boolean {
  return job.status === "completed" || job.conclusion != null;
}

export default function DeployPipelineSteps({ jobs: rawJobs }: DeployPipelineStepsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [larvaeLeft, setLarvaeLeft] = useState(TRACK_INSET_PX);
  const [progressWidth, setProgressWidth] = useState(0);

  const jobs = useMemo(() => sortWorkflowJobs(rawJobs), [rawJobs]);
  const activeIndex = useMemo(() => getPipelineActiveIndex(jobs), [jobs]);
  const completedCount = useMemo(
    () => jobs.filter((job) => job.conclusion === "success").length,
    [jobs],
  );
  const skippedCount = useMemo(
    () => jobs.filter((job) => job.conclusion === "skipped").length,
    [jobs],
  );
  const failedCount = useMemo(
    () => jobs.filter((job) => job.conclusion === "failure" || job.conclusion === "cancelled").length,
    [jobs],
  );
  const allDone = jobs.length > 0 && jobs.every(isJobSettled);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track || !jobs.length) return;

    const activeEl = stepRefs.current[activeIndex] ?? stepRefs.current[0];
    if (!activeEl) return;

    const trackRect = track.getBoundingClientRect();
    const stepRect = activeEl.getBoundingClientRect();
    const centerX = stepRect.left + stepRect.width / 2 - trackRect.left;
    setLarvaeLeft(Math.max(TRACK_INSET_PX, centerX));

    const lastSuccess = jobs.reduce(
      (acc, job, index) => (job.conclusion === "success" ? index : acc),
      -1,
    );
    if (lastSuccess < 0) {
      setProgressWidth(0);
      return;
    }
    const successEl = stepRefs.current[lastSuccess];
    if (!successEl) return;
    const successRect = successEl.getBoundingClientRect();
    const progressEnd = successRect.left + successRect.width / 2 - trackRect.left;
    setProgressWidth(Math.max(0, progressEnd - TRACK_INSET_PX));
  }, [jobs, activeIndex]);

  useLayoutEffect(() => {
    measure();
    const frame = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(frame);
  }, [measure]);

  useEffect(() => {
    const activeEl = stepRefs.current[activeIndex];
    if (!activeEl || allDone) return;

    if (typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
    const t1 = window.setTimeout(measure, 150);
    const t2 = window.setTimeout(measure, 450);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [activeIndex, allDone, measure]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(track);
    stepRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    track.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure, jobs.length]);

  if (!jobs.length) return null;

  return (
    <div className="deploy-pipeline rounded-2xl border border-[color-mix(in_srgb,var(--color-accent)_22%,transparent)] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--color-bg-elevated)_92%,transparent),color-mix(in_srgb,var(--color-bg-base)_98%,transparent))] p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-2)]">
            Pipeline
          </p>
          <p className="text-sm text-[var(--color-muted)]">
            {allDone
              ? failedCount > 0
                ? "Run finished with errors"
                : "All jobs completed"
              : `Step ${Math.min(activeIndex + 1, jobs.length)} of ${jobs.length}`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-[family-name:var(--font-mono)] text-[var(--color-muted)]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--color-neon)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-neon)_8%,transparent)] px-2 py-0.5 text-[var(--color-neon)]">
            {completedCount} done
          </span>
          {skippedCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-base)] px-2 py-0.5">
              {skippedCount} skip
            </span>
          ) : null}
          {failedCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-2 py-0.5 text-[var(--color-danger)]">
              {failedCount} failed
            </span>
          ) : null}
        </div>
      </div>

      <div ref={trackRef} className="relative overflow-x-auto pt-10 pb-2">
        <div className="min-w-[min(100%,42rem)] px-2">
          <div
            className="pointer-events-none absolute left-6 right-6 top-[3.35rem] h-0.5 rounded-full bg-[color-mix(in_srgb,var(--color-border)_80%,transparent)]"
            aria-hidden="true"
          />
          <div
            className="deploy-pipeline-progress pointer-events-none absolute top-[3.35rem] h-0.5 rounded-full bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-neon)] to-[var(--color-accent-2)]"
            style={{
              left: TRACK_INSET_PX,
              width: progressWidth > 0 ? `${progressWidth}px` : 0,
            }}
            aria-hidden="true"
          />

          {!allDone ? (
            <div
              className="deploy-pipeline-larvae pointer-events-none absolute top-0 z-20"
              style={{ left: larvaeLeft }}
              aria-hidden="true"
            >
              <div className="deploy-pipeline-larvae-glow" />
              <LorapokLarvaeLoader size="sm" ariaLabel="Pipeline progress" />
            </div>
          ) : null}

          <ol className="relative z-10 flex items-start justify-between gap-1 sm:gap-2">
            {jobs.map((job, index) => {
              const state: StepState = getJobStepState(job);
              const browser = isBrowserJob(job.name);
              const isActive = index === activeIndex && !allDone;

              return (
                <li key={job.id} className="flex min-w-[4.5rem] max-w-[7rem] flex-1 flex-col items-center">
                  <div
                    ref={(el) => {
                      stepRefs.current[index] = el;
                    }}
                    className={`deploy-pipeline-step relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                      state === "success"
                        ? "border-[var(--color-neon)] bg-[color-mix(in_srgb,var(--color-neon)_12%,transparent)] text-[var(--color-neon)] shadow-[0_0_18px_rgba(57,255,20,0.25)]"
                        : state === "failed"
                          ? "border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] text-[var(--color-danger)]"
                          : state === "skipped"
                            ? "border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-muted)] opacity-60"
                            : isActive
                              ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-accent)] shadow-[0_0_22px_rgba(124,92,255,0.35)] deploy-pipeline-step-active"
                              : browser
                                ? "border-[color-mix(in_srgb,var(--color-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_6%,transparent)] text-[var(--color-warn)]"
                                : "border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-muted)]"
                    }`}
                  >
                    {state === "success" ? (
                      <Check size={18} strokeWidth={2.5} aria-hidden="true" />
                    ) : state === "failed" ? (
                      <X size={18} strokeWidth={2.5} aria-hidden="true" />
                    ) : state === "skipped" ? (
                      <Minus size={16} aria-hidden="true" />
                    ) : state === "active" ? (
                      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Circle size={14} strokeWidth={2} aria-hidden="true" />
                    )}
                    {isActive ? <span className="deploy-pipeline-step-ring" aria-hidden="true" /> : null}
                  </div>
                  <p
                    className={`mt-2 w-full px-0.5 text-center text-[10px] leading-tight sm:text-[11px] ${
                      isActive ? "font-medium text-[var(--color-text)]" : "text-[var(--color-muted)]"
                    }`}
                    title={job.name}
                  >
                    {shortJobName(job.name)}
                  </p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-wide text-[var(--color-muted)] opacity-80">
                    {state === "success"
                      ? "done"
                      : state === "failed"
                        ? job.conclusion ?? "failed"
                        : state === "skipped"
                          ? "skip"
                          : state === "active"
                            ? "running"
                            : "queued"}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
