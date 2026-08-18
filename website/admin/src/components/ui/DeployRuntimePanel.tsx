import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Terminal } from "lucide-react";
import { fetchWorkflowRunLogs, fetchWorkflowRuns, type WorkflowRun, type WorkflowRunLogs } from "../../lib/api";
import { pickWorkflowRun } from "../../lib/workflow-run-match";
import Badge from "./Badge";
import Notification from "./Notification";

type DeployRuntimePanelProps = {
  active: boolean;
  workflowName?: string;
  targetTag?: string;
  dispatchedAfter?: number;
  onComplete?: (result: { success: boolean; run: WorkflowRun | null }) => void;
};

function runStatusTone(run: WorkflowRun): "synced" | "danger" | "neutral" {
  if (run.status === "completed" && run.conclusion === "success") return "synced";
  if (run.conclusion === "failure" || run.conclusion === "cancelled") return "danger";
  return "neutral";
}

function jobTone(conclusion: string | null | undefined, status: string): "synced" | "danger" | "neutral" {
  if (conclusion === "failure" || conclusion === "cancelled") return "danger";
  if (conclusion === "success") return "synced";
  if (status === "in_progress" || status === "queued") return "neutral";
  if (status === "completed") return "synced";
  return "neutral";
}

export default function DeployRuntimePanel({
  active,
  workflowName,
  targetTag,
  dispatchedAfter = 0,
  onComplete,
}: DeployRuntimePanelProps) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [logs, setLogs] = useState<WorkflowRunLogs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [logsOpen, setLogsOpen] = useState(true);
  const logRef = useRef<HTMLPreElement>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
  }, [dispatchedAfter, workflowName]);

  useEffect(() => {
    if (!active) {
      setRun(null);
      setLogs(null);
      setError(null);
      setWaiting(false);
      completedRef.current = false;
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const { runs } = await fetchWorkflowRuns();
        if (cancelled) return;

        const match = pickWorkflowRun(runs, { workflowName, dispatchedAfter });

        if (match) {
          setWaiting(false);
          setError(null);
          setRun(match);
          const logData = await fetchWorkflowRunLogs(match.id);
          if (!cancelled) setLogs(logData);

          const finished = match.status === "completed";
          if (finished && !completedRef.current) {
            completedRef.current = true;
            onComplete?.({
              success: match.conclusion === "success",
              run: match,
            });
          }
        } else {
          setWaiting(true);
          setError(null);
        }

        const finished = match?.status === "completed";
        const shouldPoll = Date.now() - startedAt < 15 * 60 * 1000;
        if (shouldPoll && !cancelled && !finished) {
          window.setTimeout(poll, 4000);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load workflow status");
        if (!cancelled && Date.now() - startedAt < 15 * 60 * 1000) {
          window.setTimeout(poll, 8000);
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [active, workflowName, dispatchedAfter, onComplete]);

  useEffect(() => {
    if (logRef.current && logsOpen) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs?.text, logsOpen]);

  if (!active) return null;

  const jobs = logs?.jobs ?? [];

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <Terminal size={18} className="text-[var(--color-accent)]" />
        Runtime preview
        {targetTag && <span className="text-[var(--color-muted)] font-normal">· {targetTag}</span>}
      </div>

      {error && <Notification tone="error" message={error} />}

      {waiting && !run && (
        <Notification tone="info" message={`Waiting for ${workflowName ?? "workflow"} run to appear…`} />
      )}

      {run && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant={runStatusTone(run)}>
            {run.status}
            {run.conclusion ? ` · ${run.conclusion}` : ""}
          </Badge>
          <span className="text-[var(--color-muted)]">{run.workflow}</span>
          <a
            href={run.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-accent-2)] hover:underline"
          >
            Open in GitHub <ExternalLink size={14} />
          </a>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <ol className="flex items-center gap-0 min-w-max">
            {jobs.map((job, index) => {
              const tone = jobTone(job.conclusion, job.status);
              const activeStep = job.status === "in_progress" || job.status === "queued";
              return (
                <li key={job.id} className="flex items-center">
                  <div
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border min-w-[7.5rem] max-w-[10rem] transition-all ${
                      activeStep
                        ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] shadow-[0_0_20px_rgba(124,92,255,0.2)]"
                        : "border-[var(--color-border)] bg-[var(--color-bg-base)]"
                    }`}
                  >
                    <Badge variant={tone}>{job.conclusion ?? job.status}</Badge>
                    <span className="text-[10px] text-center leading-tight text-[var(--color-muted)] line-clamp-2">
                      {job.name}
                    </span>
                    {activeStep && (
                      <span className="text-[10px] text-[var(--color-accent)] animate-pulse">running…</span>
                    )}
                  </div>
                  {index < jobs.length - 1 && (
                    <div className="flex items-center px-1 text-[var(--color-muted)]" aria-hidden="true">
                      <span
                        className={`inline-block w-6 border-t-2 ${
                          job.conclusion === "success"
                            ? "border-[var(--color-neon)]"
                            : "border-[var(--color-border)]"
                        } ${activeStep ? "animate-pulse" : ""}`}
                      />
                      <ChevronRight size={14} className={activeStep ? "text-[var(--color-accent)] animate-pulse" : ""} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {logs?.logsHint && <Notification tone="warning" message={logs.logsHint} />}

      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <button
          type="button"
          onClick={() => setLogsOpen((open) => !open)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium bg-[var(--color-bg-base)] hover:bg-white/[0.03] transition-colors"
        >
          <span className="flex items-center gap-2">
            {logsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Console output
          </span>
          <span className="text-xs text-[var(--color-muted)]">{logsOpen ? "Collapse" : "Expand"}</span>
        </button>
        {logsOpen && (
          <pre
            ref={logRef}
            className="max-h-72 overflow-auto border-t border-[var(--color-border)] bg-[#05070c] p-4 text-xs font-[family-name:var(--font-mono)] text-[#c8d6e5] leading-relaxed whitespace-pre-wrap"
          >
            {logs?.text?.trim() || "Waiting for GitHub Actions to start…"}
          </pre>
        )}
      </div>
    </div>
  );
}
