import type { ReactNode } from "react";

export default function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-panel p-4 sm:p-6 h-full ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-4"
    >
      {children}
    </h2>
  );
}

export function PageSection({
  id,
  title,
  children,
  className = "",
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <SectionHeading id={id}>{title}</SectionHeading>
      {children}
    </section>
  );
}
