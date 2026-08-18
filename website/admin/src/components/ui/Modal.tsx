import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl" | "full";
};

const sizeClass = {
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-6xl w-[min(96vw,72rem)] max-h-[min(92vh,960px)]",
};

export default function Modal({ open, onClose, title, subtitle, children, footer, size = "lg" }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${sizeClass[size]} ${size === "full" ? "" : "max-h-[min(90vh,900px)]"} flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] animate-fade-slide-up`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[var(--color-border)]">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-[var(--color-text)] truncate">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-[var(--color-muted)] mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-base)_40%,transparent)]">{footer}</div>}
      </div>
    </div>
  );
}
