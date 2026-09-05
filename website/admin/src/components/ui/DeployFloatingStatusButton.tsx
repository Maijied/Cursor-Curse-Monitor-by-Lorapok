import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import type { DeployPollStatus } from "../../context/DeployRuntimeContext";

type DeployFloatingStatusButtonProps = {
  status: DeployPollStatus;
  modeLabel: string;
  targetTag?: string;
  pipelineHint?: string;
  onClick: () => void;
};

const STATUS_LABEL: Record<DeployPollStatus, string> = {
  idle: "Deployment",
  waiting: "Starting…",
  running: "Deploying…",
  success: "Succeeded",
  failure: "Failed",
};

/**
 * Floating larvae status button — visible on every page while a deployment session is active.
 */
export default function DeployFloatingStatusButton({
  status,
  modeLabel,
  targetTag,
  pipelineHint,
  onClick,
}: DeployFloatingStatusButtonProps) {
  const label = `${modeLabel}${targetTag ? ` · ${targetTag}` : ""} — ${STATUS_LABEL[status]}`;
  const detail =
    pipelineHint && status === "running"
      ? `${pipelineHint}${targetTag ? ` · ${targetTag}` : ""}`
      : `${STATUS_LABEL[status]}${targetTag ? ` · ${targetTag}` : ""}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="deploy-floating-fab fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--color-accent)_40%,transparent)] bg-[var(--color-bg-elevated)] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] hover:border-[var(--color-accent)] hover:shadow-[0_12px_48px_rgba(124,92,255,0.25)] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      aria-label={`Open deployment status: ${label}`}
    >
      <span className="deploy-floating-fab-ring relative flex items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] p-2">
        <LorapokLarvaeLoader size="sm" ariaLabel={label} className="!gap-0" />
      </span>
      <span className="text-left min-w-0 max-w-[11rem]">
        <span className="block text-xs uppercase tracking-wide text-[var(--color-muted)]">{modeLabel}</span>
        <span className="block text-sm font-semibold text-[var(--color-text)] truncate">
          {detail}
        </span>
      </span>
    </button>
  );
}
