import { useEffect, useState } from "react";
import {
  setConfirmHandler,
  resetConfirmHandler,
  type ConfirmActionOptions,
} from "@lorapok/cursor-monitor-shared";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

type PendingConfirm = ConfirmActionOptions & {
  resolve: (ok: boolean) => void;
};

/**
 * ECO-08 — mounts shared `confirmAction` onto Mission Control Modal UI.
 * Must stay mounted for the SPA lifetime so destructive flows await the dialog.
 */
export default function ConfirmActionHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    setConfirmHandler(
      (options) =>
        new Promise<boolean>((resolve) => {
          setPending({ ...options, resolve });
        })
    );
    return () => {
      resetConfirmHandler();
      setPending((prev) => {
        prev?.resolve(false);
        return null;
      });
    };
  }, []);

  const close = (ok: boolean) => {
    setPending((prev) => {
      prev?.resolve(ok);
      return null;
    });
  };

  const severity = pending?.severity ?? "warning";
  const confirmLabel = pending?.confirmLabel ?? "Continue";
  const cancelLabel = pending?.cancelLabel ?? "Cancel";
  const destructive = severity === "destructive";

  return (
    <Modal
      open={Boolean(pending)}
      onClose={() => close(false)}
      title={pending?.title ?? "Confirm"}
      subtitle={severity === "destructive" ? "This action cannot be easily undone." : undefined}
      size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={
              destructive
                ? "px-4 py-2 rounded-xl bg-[var(--color-danger)] text-white font-medium hover:opacity-90"
                : "px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:opacity-90"
            }
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="flex gap-3 text-sm text-[var(--color-muted)]">
        <AlertTriangle
          className={`shrink-0 ${destructive ? "text-[var(--color-danger)]" : "text-[var(--color-warn)]"}`}
          size={20}
          aria-hidden="true"
        />
        <p className="whitespace-pre-wrap text-[var(--color-text)]">{pending?.message}</p>
      </div>
    </Modal>
  );
}
