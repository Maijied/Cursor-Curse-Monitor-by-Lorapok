import type { ReactNode } from "react";

export default function KpiCard({
  label,
  value,
  sub,
  icon,
  delayClass = "",
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  icon: ReactNode;
  delayClass?: string;
}) {
  return (
    <div className={`glass-panel p-6 flex items-start justify-between animate-fade-slide-up ${delayClass}`}>
      <div>
        <p className="text-sm font-medium text-[var(--color-muted)] mb-1">{label}</p>
        <h3 className="text-3xl font-bold text-[var(--color-text)] mb-2 font-[family-name:var(--font-mono)]">{value}</h3>
        {sub}
      </div>
      <div className="p-3 rounded-xl bg-white/5 border border-[var(--color-border)]">
        {icon}
      </div>
    </div>
  );
}
