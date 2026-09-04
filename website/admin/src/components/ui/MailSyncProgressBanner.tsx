import { ExternalLink, X } from "lucide-react";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import type { WorkflowRun } from "../../lib/api";
import type { WorkflowPollStatus } from "../../hooks/useWorkflowPoll";

const STATUS_COPY: Record<WorkflowPollStatus, { label: string; variant: "synced" | "warn" | "neutral" }> = {
  idle: { label: "Idle", variant: "neutral" },
  waiting: { label: "Waiting for workflow", variant: "warn" },
  running: { label: "Running", variant: "warn" },
  success: { label: "Succeeded", variant: "synced" },
  failure: { label: "Failed", variant: "warn" },
};

type MailSyncProgressBannerProps = {
  status: WorkflowPollStatus;
  run: WorkflowRun | null;
  pollError: string | null;
  onDismiss: () => void;
};

/**
 * Inline GitHub Actions progress for mail sync (Settings → Mail).
 */
export default function MailSyncProgressBanner({
  status,
  run,
  pollError,
  onDismiss,
}: MailSyncProgressBannerProps) {
  if (status === "idle") return null;

  const copy = STATUS_COPY[status];
  const showLoader = status === "waiting" || status === "running";

  return (
    <div
      className="rounded-xl border border-[var(--color-border)] bg-white/[0.03] p-4 flex flex-wrap items-start justify-between gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 min-w-0">
        {showLoader ? (
          <LorapokLarvaeLoader size="sm" ariaLabel="Mail sync in progress" className="shrink-0" />
        ) : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="font-medium text-sm text-[var(--color-text)]">Mail sync — GitHub Actions</p>
            <Badge variant={copy.variant}>{copy.label}</Badge>
          </div>
          {pollError ? (
            <p className="text-xs text-[var(--color-warn)]">{pollError}</p>
          ) : (
            <p className="text-xs text-[var(--color-muted)]">
              {status === "waiting"
                ? "Waiting for deploy-infra workflow to appear…"
                : status === "running"
                  ? `Workflow ${run?.name ?? "in progress"} on ${run?.branch ?? "main"}.`
                  : status === "success"
                    ? "Mail repair workflow finished. Transport status refreshed."
                    : "Mail repair workflow failed — open GitHub Actions for logs."}
            </p>
          )}
          {run?.url ? (
            <a
              href={run.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--color-accent)] hover:underline"
            >
              View run on GitHub <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
      {!showLoader ? (
        <button
          type="button"
          onClick={onDismiss}
          className="p-2 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5"
          aria-label="Dismiss mail sync status"
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}
