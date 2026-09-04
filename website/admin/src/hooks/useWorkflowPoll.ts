import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWorkflowRuns } from "../lib/api";
import type { WorkflowRun } from "../lib/api";
import { pickWorkflowRun } from "../lib/workflow-run-match";

export type WorkflowPollStatus = "idle" | "waiting" | "running" | "success" | "failure";

type WorkflowPollSession = {
  workflowName: string;
  dispatchedAfter: number;
  onComplete?: () => void;
};

type StartPollOptions = {
  workflowName: string;
  dispatchedAfter?: number;
  onComplete?: () => void;
};

/**
 * Poll GitHub Actions workflow runs until completion (deploy / mail sync pattern).
 */
export function useWorkflowPoll(options?: { timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? 15 * 60 * 1000;
  const [session, setSession] = useState<WorkflowPollSession | null>(null);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const completedRef = useRef(false);

  const status: WorkflowPollStatus = useMemo(() => {
    if (!session) return "idle";
    if (run?.status === "completed") {
      return run.conclusion === "success" ? "success" : "failure";
    }
    if (!run) return "waiting";
    return "running";
  }, [session, run]);

  const inProgress = status === "waiting" || status === "running";

  const startPoll = useCallback((opts: StartPollOptions) => {
    completedRef.current = false;
    setSession({
      workflowName: opts.workflowName,
      dispatchedAfter: opts.dispatchedAfter ?? Date.now(),
      onComplete: opts.onComplete,
    });
    setRun(null);
    setPollError(null);
  }, []);

  const dismiss = useCallback(() => {
    setSession(null);
    setRun(null);
    setPollError(null);
    completedRef.current = false;
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    const startedAt = Date.now();

    const abandon = (message: string) => {
      setPollError(message);
      setSession(null);
      setRun(null);
    };

    const poll = async () => {
      if (cancelled) return;

      if (Date.now() - startedAt >= timeoutMs) {
        abandon("Workflow polling timed out. Check GitHub Actions for the latest run.");
        return;
      }

      try {
        const { runs } = await fetchWorkflowRuns();
        if (cancelled) return;

        const match = pickWorkflowRun(runs, {
          workflowName: session.workflowName,
          dispatchedAfter: session.dispatchedAfter,
        });

        if (match) {
          setPollError(null);
          setRun(match);

          if (match.status === "completed" && !completedRef.current) {
            completedRef.current = true;
            session.onComplete?.();
            return;
          }
        } else {
          setRun(null);
        }

        if (!cancelled && match?.status !== "completed") {
          window.setTimeout(poll, match ? 4000 : 5000);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setPollError(err instanceof Error ? err.message : "Failed to load workflow status");
        if (Date.now() - startedAt < timeoutMs) {
          window.setTimeout(poll, 8000);
        } else {
          abandon("Workflow polling timed out. Check GitHub Actions for the latest run.");
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [session, timeoutMs]);

  return { status, run, pollError, inProgress, startPoll, dismiss };
}
