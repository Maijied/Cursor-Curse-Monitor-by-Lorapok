import type { ReactNode } from "react";

export default function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 animate-fade-slide-up">
      <div>
        <h2 className="text-3xl font-bold text-[var(--color-text)] mb-2">{title}</h2>
        {description && <p className="text-[var(--color-muted)] max-w-2xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}
