import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Terminal } from "lucide-react";
import { fetchWorkflowRunLogs, fetchWorkflowRuns, type WorkflowRun, type WorkflowRunLogs } from "../../lib/api";
import { pickWorkflowRun } from "../../lib/workflow-run-match";
import Badge from "./Badge";
import DeployPipelineSteps from "./DeployPipelineSteps";
import MarketplaceDeployBreakdown from "./MarketplaceDeployBreakdown";
import Notification from "./Notification";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";

type DeployRuntimePanelProps = {
  active: boolean;
  workflowName?: string;
  targetTag?: string;
  dispatchedAfter?: number;
  /** When true, poll state is supplied by DeployRuntimeContext (no internal polling). */
  embedded?: boolean;
  run?: WorkflowRun | null;
  logs?: WorkflowRunLogs | null;
  pollError?: string | null;
  waiting?: boolean;
  onComplete?: (result: {
    success: boolean;
    run: WorkflowRun | null;
    jobs?: WorkflowRunLogs["jobs"];
  }) => void;
};

/**
 * Determines the visual status tone for a workflow run.
 *
 * @param run - The workflow run to classify
 * @returns `synced` for successful completed runs, `danger` for failed or cancelled runs, and `neutral` otherwise
 */
function runStatusTone(run: WorkflowRun): "synced" | "danger" | "neutral" {
  if (run.status === "completed" && run.conclusion === "success") return "synced";
  if (run.conclusion === "failure" || run.conclusion === "cancelled") return "danger";
  return "neutral";
}

/**
 * Displays deployment workflow status, pipeline details, warnings, and expandable console output.
 *
 * @param active - Whether the panel is visible and its workflow status is tracked
 * @param workflowName - Workflow to monitor
 * @param dispatchedAfter - Timestamp used to identify the relevant workflow run
 * @param embedded - Whether to use externally supplied workflow data instead of polling
 * @param onComplete - Callback invoked when the workflow completes
 * @returns The deployment runtime panel, or `null` when inactive
 */
export default function DeployRuntimePanel({
  active,
  workflowName,
  targetTag,
  dispatchedAfter = 0,
  embedded = false,
  run: externalRun,
  logs: externalLogs,
  pollError: externalError,
  waiting: externalWaiting,
  onComplete,
}: DeployRuntimePanelProps) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [logs, setLogs] = useState<WorkflowRunLogs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const completedRef = useRef(false);

  const displayRun = embedded ? externalRun ?? null : run;
  const displayLogs = embedded ? externalLogs ?? null : logs;
  const displayError = embedded ? externalError ?? null : error;
  const displayWaiting = embedded ? Boolean(externalWaiting) : waiting;

  useEffect(() => {
    completedRef.current = false;
  }, [dispatchedAfter, workflowName]);

  useEffect(() => {
    if (!active) {
      if (!embedded) {
        setRun(null);
        setLogs(null);
        setError(null);
        setWaiting(false);
      }
      setLogsOpen(false);
      completedRef.current = false;
      return;
    }
    setLogsOpen(false);
  }, [active, dispatchedAfter, workflowName, embedded]);

  useEffect(() => {
    if (!active || embedded) return;

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
              jobs: logData?.jobs ?? [],
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
  }, [active, workflowName, dispatchedAfter, onComplete, embedded]);

  useEffect(() => {
    if (logRef.current && logsOpen) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [displayLogs?.text, logsOpen]);

  if (!active) return null;

  const jobs = displayLogs?.jobs ?? [];

  return (
    <div className={`space-y-4 ${embedded ? "" : "mt-6"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <Terminal size={18} className="text-[var(--color-accent)]" />
        Deployment runtime
        {targetTag && <span className="text-[var(--color-muted)] font-normal">· {targetTag}</span>}
      </div>

      {displayError && <Notification tone="error" message={displayError} />}

      {displayWaiting && !displayRun && (
        <div className="flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--color-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] p-4">
          <LorapokLarvaeLoader size="sm" ariaLabel="Waiting for workflow" />
          <p className="text-sm text-[var(--color-muted)]">
            Waiting for {workflowName ?? "workflow"} run to appear…
          </p>
        </div>
      )}

      {displayRun && (
        <div className="flex flex-wrap items-center gap-3 text-sm animate-fade-slide-up">
          <Badge variant={runStatusTone(displayRun)}>
            {displayRun.status}
            {displayRun.conclusion ? ` · ${displayRun.conclusion}` : ""}
          </Badge>
          <span className="text-[var(--color-muted)]">{displayRun.workflow}</span>
          <a
            href={displayRun.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-accent-2)] hover:underline"
          >
            Open in GitHub <ExternalLink size={14} />
          </a>
        </div>
      )}

      {jobs.length > 0 && <DeployPipelineSteps jobs={jobs} />}

      {jobs.length > 0 && <MarketplaceDeployBreakdown jobs={jobs} targetTag={targetTag} />}

      {displayLogs?.logsHint && <Notification tone="warning" message={displayLogs.logsHint} />}

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
            className="max-h-72 overflow-auto border-t border-[var(--color-border)] bg-[#05070c] p-4 text-xs font-[family-name:var(--font-mono)] text-[#c8d6e5] leading-relaxed whitespace-pre-wrap animate-fade-slide-up"
          >
            {displayLogs?.text?.trim() || "Waiting for GitHub Actions to start…"}
          </pre>
        )}
      </div>
    </div>
  );
}
