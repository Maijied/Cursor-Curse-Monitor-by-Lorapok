import { createContext, useContext } from "react";
import type { WorkflowRun, WorkflowRunLogs } from "../lib/api";

export type DeploySession = {
  workflowName: string;
  targetTag: string;
  dispatchedAfter: number;
  channel: string;
  market: string;
  modeLabel: string;
};

export type DeployPollStatus = "idle" | "waiting" | "running" | "success" | "failure";

export type DeployRuntimeContextValue = {
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
  dismissSession: () => void;
  statusModalOpen: boolean;
};

export const DeployRuntimeContext = createContext<DeployRuntimeContextValue | null>(null);

/**
 * Retrieves the deployment runtime context.
 *
 * @throws If called outside a `DeployRuntimeProvider`.
 */
export function useDeployRuntime() {
  const ctx = useContext(DeployRuntimeContext);
  if (!ctx) throw new Error("useDeployRuntime must be used within DeployRuntimeProvider");
  return ctx;
}

/**
 * Retrieves the deployment runtime context when available.
 */
export function useDeployRuntimeOptional() {
  return useContext(DeployRuntimeContext);
}
