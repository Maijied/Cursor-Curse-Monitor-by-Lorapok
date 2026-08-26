import Modal from "./Modal";
import DeployRuntimePanel from "./DeployRuntimePanel";
import type { DeployPollStatus, DeploySession } from "../../context/DeployRuntimeContext";
import type { WorkflowRun, WorkflowRunLogs } from "../../lib/api";

type DeployStatusModalProps = {
  open: boolean;
  onClose: () => void;
  session: DeploySession | null;
  status: DeployPollStatus;
  run: WorkflowRun | null;
  logs: WorkflowRunLogs | null;
  pollError: string | null;
  waiting: boolean;
};

export default function DeployStatusModal({
  open,
  onClose,
  session,
  status,
  run,
  logs,
  pollError,
  waiting,
}: DeployStatusModalProps) {
  if (!session) return null;

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
    </Modal>
  );
}
