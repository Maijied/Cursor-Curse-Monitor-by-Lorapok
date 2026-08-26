import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { WorkflowRun, WorkflowRunLogs } from "../lib/api";
import DeployFloatingStatusButton from "../components/ui/DeployFloatingStatusButton";
import DeployLeaveWarningModal from "../components/ui/DeployLeaveWarningModal";
import DeployStatusModal from "../components/ui/DeployStatusModal";

export type DeploySession = {
  workflowName: string;
  targetTag: string;
  dispatchedAfter: number;
  channel: string;
  market: string;
  modeLabel: string;
};

export type DeployPollStatus = "idle" | "waiting" | "running" | "success" | "failure";

type DeployRuntimeContextValue = {
  session: DeploySession | null;
  status: DeployPollStatus;
  run: WorkflowRun | null;
  logs: WorkflowRunLogs | null;
  pollError: string | null;
  waiting: boolean;
  inProgress: boolean;
  startSession: (session: DeploySession) => void;
  registerInlineAnchor: (el: HTMLDivElement | null) => void;
  scrollToInlinePanel: () => void;
  openStatusModal: () => void;
  closeStatusModal: () => void;
  registerOnDeployComplete: (fn: (() => void) | null) => void;
  statusModalOpen: boolean;
};

const DeployRuntimeContext = createContext<DeployRuntimeContextValue | null>(null);

/**
 * Retrieves the deployment runtime context.
 *
 * @returns The deployment runtime context.
 * @throws If called outside a `DeployRuntimeProvider`.
 */
export function useDeployRuntime() {
  const ctx = useContext(DeployRuntimeContext);
  if (!ctx) throw new Error("useDeployRuntime must be used within DeployRuntimeProvider");
  return ctx;
}

/**
 * Retrieves the deployment runtime context when available.
 *
 * @returns The deployment runtime context, or `undefined` when used outside a `DeployRuntimeProvider`.
 */
export function useDeployRuntimeOptional() {
  return useContext(DeployRuntimeContext);
}

type ProviderProps = { children: ReactNode };

/**
 * Provides deployment state, workflow progress, and session controls to descendant components.
 *
 * While a deployment is active, maintains workflow polling and displays status and navigation-warning UI.
 */
export function DeployRuntimeProvider({ children }: ProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<DeploySession | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [leaveWarningOpen, setLeaveWarningOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [tabReturnNotice, setTabReturnNotice] = useState(false);

  const onCompleteRef = useRef<(() => void) | null>(null);

  const registerOnDeployComplete = useCallback((fn: (() => void) | null) => {
    onCompleteRef.current = fn;
  }, []);
  const inlineAnchorRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);
  const leftTabDuringDeployRef = useRef(false);

  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [logs, setLogs] = useState<WorkflowRunLogs | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  const onDeploymentsPage = location.pathname.includes("/deployments");
  const inProgress = Boolean(session);

  const status: DeployPollStatus = useMemo(() => {
    if (!session) return "idle";
    if (run?.status === "completed") {
      return run.conclusion === "success" ? "success" : "failure";
    }
    if (waiting && !run) return "waiting";
    return "running";
  }, [session, run, waiting]);

  const registerInlineAnchor = useCallback((el: HTMLDivElement | null) => {
    inlineAnchorRef.current = el;
  }, []);

  const scrollToInlinePanel = useCallback(() => {
    inlineAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const startSession = useCallback((next: DeploySession) => {
    completedRef.current = false;
    setSession(next);
    setRun(null);
    setLogs(null);
    setPollError(null);
    setWaiting(false);
    setStatusModalOpen(false);
    setTabReturnNotice(false);
    window.requestAnimationFrame(() => {
      inlineAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const finishSession = useCallback(() => {
    if (!session) return;
    onCompleteRef.current?.();
    setSession(null);
    setStatusModalOpen(false);
  }, [session]);

  const abandonSession = useCallback((message: string) => {
    setPollError(message);
    onCompleteRef.current?.();
    setSession(null);
    setStatusModalOpen(false);
  }, []);

  const openStatusModal = useCallback(() => setStatusModalOpen(true), []);
  const closeStatusModal = useCallback(() => setStatusModalOpen(false), []);

  // Poll GitHub while a session is active (survives route changes).
  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    const startedAt = Date.now();
    const pollTimeoutMs = 15 * 60 * 1000;

    const poll = async () => {
      if (cancelled) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed >= pollTimeoutMs) {
        abandonSession("Workflow status polling timed out. Check GitHub Actions for the latest run.");
        return;
      }

      try {
        const { fetchWorkflowRuns, fetchWorkflowRunLogs } = await import("../lib/api");
        const { pickWorkflowRun } = await import("../lib/workflow-run-match");
        const { runs } = await fetchWorkflowRuns();
        if (cancelled) return;

        const match = pickWorkflowRun(runs, {
          workflowName: session.workflowName,
          dispatchedAfter: session.dispatchedAfter,
        });

        if (match) {
          setWaiting(false);
          setPollError(null);
          setRun(match);
          const logData = await fetchWorkflowRunLogs(match.id);
          if (!cancelled) setLogs(logData);

          if (match.status === "completed" && !completedRef.current) {
            completedRef.current = true;
            finishSession();
            return;
          }
        } else {
          setWaiting(true);
          setPollError(null);
        }

        if (!cancelled && match?.status !== "completed") {
          window.setTimeout(poll, 4000);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setPollError(err instanceof Error ? err.message : "Failed to load workflow status");
        if (Date.now() - startedAt < pollTimeoutMs) {
          window.setTimeout(poll, 8000);
        } else {
          abandonSession("Workflow status polling timed out. Check GitHub Actions for the latest run.");
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [session, finishSession, abandonSession]);

  // Warn when closing the browser tab mid-deploy.
  useEffect(() => {
    if (!inProgress) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [inProgress]);

  // Notice when returning to the tab after switching away during deploy.
  useEffect(() => {
    if (!inProgress) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        leftTabDuringDeployRef.current = true;
      } else if (document.visibilityState === "visible" && leftTabDuringDeployRef.current) {
        leftTabDuringDeployRef.current = false;
        setTabReturnNotice(true);
        if (!onDeploymentsPage) setStatusModalOpen(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [inProgress, onDeploymentsPage]);

  // Intercept in-app navigation while deploy is running.
  useEffect(() => {
    if (!inProgress) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.href.startsWith("mailto:")) return;
      if (
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        link.hasAttribute("download")
      ) {
        return;
      }
      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname.includes("/deployments")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingPath(url.pathname + url.search + url.hash);
      setLeaveWarningOpen(true);
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [inProgress]);

  const confirmLeave = useCallback(() => {
    setLeaveWarningOpen(false);
    if (pendingPath) {
      navigate(pendingPath);
      setPendingPath(null);
    }
  }, [navigate, pendingPath]);

  const value = useMemo(
    () => ({
      session,
      status,
      run,
      logs,
      pollError,
      waiting,
      inProgress,
      startSession,
      registerInlineAnchor,
      scrollToInlinePanel,
      openStatusModal,
      closeStatusModal,
      statusModalOpen,
      registerOnDeployComplete,
    }),
    [
      session,
      status,
      run,
      logs,
      pollError,
      waiting,
      inProgress,
      startSession,
      registerInlineAnchor,
      scrollToInlinePanel,
      openStatusModal,
      closeStatusModal,
      statusModalOpen,
      registerOnDeployComplete,
    ]
  );

  return (
    <DeployRuntimeContext.Provider value={value}>
      {children}
      {inProgress && (
        <>
          <DeployFloatingStatusButton
            status={status}
            modeLabel={session?.modeLabel ?? "Deployment"}
            targetTag={session?.targetTag}
            onClick={openStatusModal}
            hiddenOnDeploymentsPage={onDeploymentsPage && !statusModalOpen}
          />
          <DeployStatusModal
            open={statusModalOpen}
            onClose={closeStatusModal}
            session={session}
            status={status}
            run={run}
            logs={logs}
            pollError={pollError}
            waiting={waiting}
          />
          <DeployLeaveWarningModal
            open={leaveWarningOpen}
            onStay={() => {
              setLeaveWarningOpen(false);
              setPendingPath(null);
            }}
            onLeave={confirmLeave}
          />
          {tabReturnNotice && onDeploymentsPage && (
            <div className="fixed bottom-24 right-6 z-[90] max-w-sm animate-fade-slide-up">
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-accent)_35%,transparent)] bg-[var(--color-bg-elevated)] px-4 py-3 shadow-lg text-sm">
                <p className="font-medium text-[var(--color-text)]">Deployment still running</p>
                <p className="text-[var(--color-muted)] mt-1">Check progress below or tap the larvae button.</p>
                <button
                  type="button"
                  className="mt-2 text-[var(--color-accent-2)] hover:underline text-sm"
                  onClick={() => setTabReturnNotice(false)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </DeployRuntimeContext.Provider>
  );
}
