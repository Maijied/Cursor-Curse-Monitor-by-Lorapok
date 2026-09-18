import { useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";

export default function PageHeader({
  title,
  description,
  action,
  hint,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional contextual help for dense operator pages. */
  hint?: ReactNode;
}) {
  const [hintOpen, setHintOpen] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 animate-fade-slide-up">
      <div className="min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <h2 className="text-3xl font-bold text-[var(--color-text)] mb-2">{title}</h2>
          {hint ? (
            <button
              type="button"
              onClick={() => setHintOpen((o) => !o)}
              className="mt-1.5 p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-white/5 border border-transparent hover:border-[var(--color-border)]"
              aria-expanded={hintOpen}
              aria-label={`Help for ${title}`}
            >
              <HelpCircle size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {description && <p className="text-[var(--color-muted)] max-w-2xl">{description}</p>}
        {hint && hintOpen ? (
          <div className="mt-3 max-w-2xl text-sm text-[var(--color-muted)] leading-relaxed border-l-2 border-[var(--color-accent)] pl-3 space-y-2">
            {hint}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}
