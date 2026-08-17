import { useEffect, useRef, useState } from "react";
import { ExternalLink, Terminal } from "lucide-react";
import { fetchWorkflowRunLogs, fetchWorkflowRuns, type WorkflowRun, type WorkflowRunLogs } from "../../lib/api";
import Badge from "./Badge";
import Notification from "./Notification";

type DeployRuntimePanelProps = {
  active: boolean;
  workflowName?: string;
  targetTag?: string;
  onComplete?: () => void;
};

function runStatusTone(run: WorkflowRun): "synced" | "danger" | "neutral" {
  if (run.status === "completed" && run.conclusion === "success") return "synced";
  if (run.conclusion === "failure" || run.conclusion === "cancelled") return "danger";
  return "neutral";
}

export default function DeployRuntimePanel({ active, workflowName, targetTag, onComplete }: DeployRuntimePanelProps) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [logs, setLogs] = useState<WorkflowRunLogs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setRun(null);
      setLogs(null);
      setError(null);
      completedRef.current = false;
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const { runs } = await fetchWorkflowRuns();
        if (cancelled) return;

        const match =
          runs.find((r) => {
            const recent = Date.now() - new Date(r.createdAt).getTime() < 15 * 60 * 1000;
            const workflowOk = workflowName ? r.workflow.includes(workflowName.replace(".yml", "")) : true;
            return recent && workflowOk && (r.status === "in_progress" || r.status === "queued" || r.status === "completed");
          }) ?? runs[0];

        if (match) {
          setRun(match);
          const logData = await fetchWorkflowRunLogs(match.id);
          if (!cancelled) setLogs(logData);

          const finished = match.status === "completed";
          if (finished && !completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
          if (!finished || Date.now() - startedAt < 120_000) {
            window.setTimeout(poll, finished ? 8000 : 4000);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load workflow status");
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [active, workflowName, onComplete]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs?.text]);

  if (!active) return null;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <Terminal size={18} className="text-[var(--color-accent)]" />
        Runtime preview
        {targetTag && <span className="text-[var(--color-muted)] font-normal">· {targetTag}</span>}
      </div>

      {error && <Notification tone="error" message={error} />}

      {run && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant={runStatusTone(run)}>{run.status}{run.conclusion ? ` · ${run.conclusion}` : ""}</Badge>
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

      {logs?.jobs?.length ? (
        <div className="flex flex-wrap gap-2">
          {logs.jobs.map((job) => (
            <Badge key={job.id} variant={job.conclusion === "success" ? "synced" : job.conclusion === "failure" ? "danger" : "neutral"}>
              {job.name}: {job.status}
            </Badge>
          ))}
        </div>
      ) : null}

      <pre
        ref={logRef}
        className="max-h-72 overflow-auto rounded-xl border border-[var(--color-border)] bg-[#05070c] p-4 text-xs font-[family-name:var(--font-mono)] text-[#c8d6e5] leading-relaxed whitespace-pre-wrap"
      >
        {logs?.text?.trim() || "Waiting for GitHub Actions to start…"}
      </pre>
    </div>
  );
}
