import { AlertTriangle } from "lucide-react";

export default function ErrorState({ title, message }: { title?: string; message: string }) {
  return (
    <div className="glass-panel p-6 border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] flex gap-4 items-start">
      <AlertTriangle className="text-[var(--color-danger)] shrink-0" size={22} aria-hidden="true" />
      <div>
        <h3 className="font-semibold text-[var(--color-text)] mb-1">{title ?? "Something went wrong"}</h3>
        <p className="text-sm text-[var(--color-muted)]">{message}</p>
      </div>
    </div>
  );
}
