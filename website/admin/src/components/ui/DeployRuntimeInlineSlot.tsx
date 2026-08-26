import { useCallback } from "react";
import { useDeployRuntime } from "../../context/DeployRuntimeContext";
import DeployRuntimePanel from "./DeployRuntimePanel";

/**
 * Renders the inline deployment runtime panel for an active deployment.
 *
 * @returns The deployment panel, or an aria-hidden anchor when the panel is unavailable or a status modal is open.
 */
export default function DeployRuntimeInlineSlot() {
  const {
    session,
    inProgress,
    registerInlineAnchor,
    run,
    logs,
    pollError,
    waiting,
    statusModalOpen,
  } = useDeployRuntime();

  const setAnchorRef = useCallback(
    (el: HTMLDivElement | null) => {
      registerInlineAnchor(el);
    },
    [registerInlineAnchor]
  );

  if (!inProgress || !session) {
    return <div ref={setAnchorRef} aria-hidden="true" />;
  }

  if (statusModalOpen) {
    return <div ref={setAnchorRef} aria-hidden="true" />;
  }

  return (
    <div ref={setAnchorRef} className="mt-6 scroll-mt-24">
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
    </div>
  );
}
