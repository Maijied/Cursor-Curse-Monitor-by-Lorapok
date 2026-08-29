import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";

export type NotificationTone = "success" | "error" | "info" | "warning" | "loading";

type NotificationProps = {
  tone: NotificationTone;
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
};

const toneStyles: Record<NotificationTone, { box: string; icon: typeof CheckCircle2 | null; iconClass: string }> = {
  success: {
    box: "bg-[color-mix(in_srgb,var(--color-ok)_10%,transparent)] border-[color-mix(in_srgb,var(--color-ok)_35%,transparent)] shadow-[0_10px_28px_color-mix(in_srgb,var(--color-ok)_12%,transparent)]",
    icon: CheckCircle2,
    iconClass: "text-[var(--color-ok)]",
  },
  error: {
    box: "bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] shadow-[0_10px_28px_color-mix(in_srgb,var(--color-danger)_12%,transparent)]",
    icon: AlertCircle,
    iconClass: "text-[var(--color-danger)]",
  },
  warning: {
    box: "bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] shadow-[0_10px_28px_color-mix(in_srgb,var(--color-warn)_12%,transparent)]",
    icon: AlertCircle,
    iconClass: "text-[var(--color-warn)]",
  },
  info: {
    box: "bg-[color-mix(in_srgb,var(--color-accent-2)_10%,transparent)] border-[color-mix(in_srgb,var(--color-accent-2)_30%,transparent)] shadow-[0_10px_28px_color-mix(in_srgb,var(--color-accent-2)_10%,transparent)]",
    icon: Info,
    iconClass: "text-[var(--color-accent-2)]",
  },
  loading: {
    box: "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]",
    icon: null,
    iconClass: "",
  },
};

const barColors: Record<NotificationTone, string> = {
  success: "from-transparent via-[var(--color-ok)] to-transparent",
  error: "from-transparent via-[var(--color-danger)] to-transparent",
  warning: "from-transparent via-[var(--color-warn)] to-transparent",
  info: "from-transparent via-[var(--color-accent-2)] to-transparent",
  loading: "from-transparent via-[var(--color-accent)] to-transparent",
};

export default function Notification({ tone, title, message, onDismiss, className = "" }: NotificationProps) {
  const style = toneStyles[tone];
  const Icon = style.icon;
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      role="status"
      aria-live={tone === "error" ? "assertive" : "polite"}
      initial={reduceMotion ? false : { opacity: 0, y: -10, scale: 0.98, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.85 }}
      className={`relative overflow-hidden flex gap-3 p-4 rounded-xl border ${style.box} ${className}`}
    >
      <motion.span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${barColors[tone]}`}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "left center" }}
      />

      {tone === "loading" ? (
        <motion.div
          className="shrink-0 mt-0.5"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 24, delay: 0.04 }}
        >
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading" />
        </motion.div>
      ) : Icon ? (
        <motion.div
          className="shrink-0 mt-0.5"
          initial={{ scale: 0.55, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 22, delay: 0.05 }}
        >
          <Icon size={20} className={style.iconClass} aria-hidden="true" />
        </motion.div>
      ) : null}

      <div className="flex-1 min-w-0">
        {title ? (
          <motion.p
            className="font-semibold text-[var(--color-text)] mb-0.5"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, delay: 0.08 }}
          >
            {title}
          </motion.p>
        ) : null}
        <motion.p
          className={`text-sm leading-relaxed ${title ? "text-[var(--color-muted)]" : "text-[var(--color-text)]"}`}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {message}
        </motion.p>
      </div>

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5"
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      ) : null}
    </motion.div>
  );
}
