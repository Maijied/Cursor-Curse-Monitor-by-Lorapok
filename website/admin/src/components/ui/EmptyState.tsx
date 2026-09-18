import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
};

/**
 * Friendly empty placeholder for lists and dense admin panels.
 */
export default function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-3 px-6 py-12 rounded-2xl border border-dashed border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-base)_55%,transparent)] ${className}`}
      role="status"
    >
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)]">
        <Icon size={22} aria-hidden="true" />
      </div>
      <div className="max-w-md space-y-1.5">
        <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
        {description ? <p className="text-sm text-[var(--color-muted)] leading-relaxed">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
