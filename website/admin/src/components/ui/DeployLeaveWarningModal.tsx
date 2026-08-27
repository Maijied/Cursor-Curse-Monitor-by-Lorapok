import Modal from "./Modal";
import { AlertTriangle } from "lucide-react";

type DeployLeaveWarningModalProps = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
};

/**
 * Displays a warning when leaving a page during an active deployment.
 *
 * @param open - Whether the warning modal is visible
 * @param onStay - Called when the user closes the modal or chooses to keep watching
 * @param onLeave - Called when the user chooses to leave the page
 */
export default function DeployLeaveWarningModal({ open, onStay, onLeave }: DeployLeaveWarningModalProps) {
  return (
    <Modal
      open={open}
      onClose={onStay}
      title="Deployment in progress"
      subtitle="Leaving this page won't cancel the GitHub Actions workflow, but you'll lose the live status view."
      size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onStay}
            className="px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:opacity-90"
          >
            Stay and watch
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Leave anyway
          </button>
        </div>
      }
    >
      <div className="flex gap-3 text-sm text-[var(--color-muted)]">
        <AlertTriangle className="shrink-0 text-[var(--color-warn)]" size={20} aria-hidden="true" />
        <p>
          Use the floating larvae button in the corner to reopen the deployment animation and pipeline status from any
          page.
        </p>
      </div>
    </Modal>
  );
}
