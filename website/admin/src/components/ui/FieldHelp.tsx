import { useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";

type FieldHelpProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

/**
 * Inline field label with expandable help text for settings forms.
 */
export default function FieldHelp({ label, children, className = "" }: FieldHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="p-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-white/5"
          aria-expanded={open}
          aria-label={`Help for ${label}`}
        >
          <HelpCircle size={14} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <p className="mt-2 text-xs text-[var(--color-muted)] leading-relaxed border-l-2 border-[var(--color-accent)] pl-3">
          {children}
        </p>
      )}
    </div>
  );
}
