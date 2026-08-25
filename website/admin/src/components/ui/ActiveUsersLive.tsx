import { Users } from "lucide-react";
import { useUsageStats } from "../../hooks/useUsageStats";
import { formatCount } from "../../lib/site-data";

type ActiveUsersLiveProps = {
  compact?: boolean;
  className?: string;
};

function activeLabel(count: number): string {
  if (count === 1) return "1 user active now";
  return `${formatCount(count)} users active now`;
}

/**
 * Live opt-in extension heartbeats in the last 5 minutes — "using right now".
 */
export default function ActiveUsersLive({ compact = false, className = "" }: ActiveUsersLiveProps) {
  const { stats, live } = useUsageStats();
  const count = stats?.optInUniques?.activeNow ?? 0;

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)] ${className}`}
        title={activeLabel(count)}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${live ? "bg-[var(--color-neon)] animate-pulse" : "bg-[var(--color-muted)]"}`}
          aria-hidden="true"
        />
        <Users size={11} className="shrink-0 opacity-70" aria-hidden="true" />
        <span className="tabular-nums">{formatCount(count)}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[color-mix(in_srgb,var(--color-neon)_22%,transparent)] bg-[color-mix(in_srgb,var(--color-neon)_6%,transparent)] ${className}`}
      role="status"
      title={live ? "Live heartbeat feed" : "Usage stats unavailable"}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${live ? "bg-[var(--color-neon)] animate-ping" : "bg-[var(--color-muted)]"}`}
        />
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${live ? "bg-[var(--color-neon)]" : "bg-[var(--color-muted)]"}`}
        />
      </span>
      <Users size={14} className="text-[var(--color-neon)] shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--color-text)] leading-tight tabular-nums">
          {activeLabel(count)}
        </p>
        <p className="text-[10px] text-[var(--color-muted)] leading-tight">
          {live ? "Extension heartbeats · last 5 min" : "Polling usage stats…"}
        </p>
      </div>
    </div>
  );
}
