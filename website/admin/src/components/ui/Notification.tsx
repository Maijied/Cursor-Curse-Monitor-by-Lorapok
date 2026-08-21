import { CheckCircle2, AlertCircle, Info, X, Loader2 } from "lucide-react";

export type NotificationTone = "success" | "error" | "info" | "warning" | "loading";

type NotificationProps = {
  tone: NotificationTone;
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
};

const toneStyles: Record<NotificationTone, { box: string; icon: typeof CheckCircle2; iconClass: string }> = {
  success: {
    box: "bg-[color-mix(in_srgb,var(--color-ok)_10%,transparent)] border-[color-mix(in_srgb,var(--color-ok)_35%,transparent)]",
    icon: CheckCircle2,
    iconClass: "text-[var(--color-ok)]",
  },
  error: {
    box: "bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)]",
    icon: AlertCircle,
    iconClass: "text-[var(--color-danger)]",
  },
  warning: {
    box: "bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)]",
    icon: AlertCircle,
    iconClass: "text-[var(--color-warn)]",
  },
  info: {
    box: "bg-[color-mix(in_srgb,var(--color-accent-2)_10%,transparent)] border-[color-mix(in_srgb,var(--color-accent-2)_30%,transparent)]",
    icon: Info,
    iconClass: "text-[var(--color-accent-2)]",
  },
  loading: {
    box: "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]",
    icon: Loader2,
    iconClass: "text-[var(--color-accent)] animate-spin",
  },
};

export default function Notification({ tone, title, message, onDismiss, className = "" }: NotificationProps) {
  const style = toneStyles[tone];
  const Icon = style.icon;

  return (
    <div
      role="status"
      className={`flex gap-3 p-4 rounded-xl border ${style.box} ${className}`}
    >
      <Icon size={20} className={`shrink-0 mt-0.5 ${style.iconClass}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-[var(--color-text)] mb-0.5">{title}</p>}
        <p className={`text-sm leading-relaxed ${title ? "text-[var(--color-muted)]" : "text-[var(--color-text)]"}`}>{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5"
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
