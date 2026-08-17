import type { ReactNode } from "react";

type BadgeVariant = "synced" | "drift" | "warn" | "danger" | "neutral";

const styles: Record<BadgeVariant, string> = {
  synced: "bg-[color-mix(in_srgb,var(--color-neon)_15%,transparent)] text-[var(--color-neon)] border-[color-mix(in_srgb,var(--color-neon)_30%,transparent)]",
  drift: "bg-[color-mix(in_srgb,var(--color-warn)_15%,transparent)] text-[var(--color-warn)] border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)]",
  warn: "bg-[color-mix(in_srgb,var(--color-warn)_15%,transparent)] text-[var(--color-warn)] border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)]",
  danger: "bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)] border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)]",
  neutral: "bg-white/5 text-[var(--color-muted)] border-[var(--color-border)]",
};

export default function Badge({
  variant = "neutral",
  children,
  pulse,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${styles[variant]} ${pulse ? "animate-pulse-neon" : ""}`}
    >
      {children}
    </span>
  );
}
