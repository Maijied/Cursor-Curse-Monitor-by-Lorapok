import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Card from "./Card";

type CollapsibleCardProps = {
  title: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  /** Always visible next to the collapse control (e.g. action buttons). */
  actions?: ReactNode;
  /** Shown under the title when expanded; one-line preview when collapsed. */
  subtitle?: ReactNode;
};

export default function CollapsibleCard({
  title,
  children,
  className = "",
  defaultOpen = false,
  actions,
  subtitle,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="group flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-expanded={open}
          aria-controls={panelId}
        >
          <span
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-muted)] transition-all duration-300 group-hover:border-[color-mix(in_srgb,var(--color-accent)_35%,transparent)] group-hover:text-[var(--color-accent)] ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <ChevronDown size={18} className="transition-transform duration-300" />
          </span>
          <span className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
            {typeof subtitle === "string" && !open ? (
              <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">{subtitle}</p>
            ) : null}
          </span>
        </button>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              {subtitle && open ? (
                <div className="mb-4 text-sm text-[var(--color-muted)]">{subtitle}</div>
              ) : null}
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  );
}
