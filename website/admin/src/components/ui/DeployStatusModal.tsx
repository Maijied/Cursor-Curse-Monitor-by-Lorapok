import Modal from "./Modal";
import DeployRuntimePanel from "./DeployRuntimePanel";
import type { DeployPollStatus, DeploySession } from "../../context/DeployRuntimeContext";
import type { WorkflowRun, WorkflowRunLogs } from "../../lib/api";

type DeployStatusModalProps = {
  open: boolean;
  onClose: () => void;
  onDismiss: () => void;
  session: DeploySession | null;
  status: DeployPollStatus;
  run: WorkflowRun | null;
  logs: WorkflowRunLogs | null;
  pollError: string | null;
  waiting: boolean;
};

/**
 * Displays the deployment workflow status for an active session.
 *
 * @returns The deployment status modal, or `null` when no deployment session exists.
 */
export default function DeployStatusModal({
  open,
  onClose,
  onDismiss,
  session,
  status,
  run,
  logs,
  pollError,
  waiting,
}: DeployStatusModalProps) {
  if (!session) return null;

  const finished = status === "success" || status === "failure";
  const subtitle =
    status === "success"
      ? "Workflow finished successfully"
      : status === "failure"
        ? "Workflow finished with errors"
        : status === "waiting"
          ? "Waiting for GitHub Actions…"
          : "Live pipeline status";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${session.modeLabel} status`}
      subtitle={subtitle}
      size="xl"
    >
      <DeployRuntimePanel
        active
        embedded
        workflowName={session.workflowName}
        targetTag={session.targetTag}
        dispatchedAfter={session.dispatchedAfter}
        run={run}
        logs={logs}
        pollError={pollError}
        waiting={waiting}
      />
      {finished ? (
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border)] pt-4">
          {run?.url ? (
            <a
              href={run.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[var(--color-accent-2)] hover:underline"
            >
              Open workflow in GitHub
            </a>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
