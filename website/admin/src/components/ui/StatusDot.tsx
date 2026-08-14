type Status = "ok" | "warn" | "danger" | "neutral";

const colors: Record<Status, string> = {
  ok: "bg-[var(--color-neon)]",
  warn: "bg-[var(--color-warn)]",
  danger: "bg-[var(--color-danger)]",
  neutral: "bg-[var(--color-muted)]",
};

export default function StatusDot({ status = "neutral", pulse }: { status?: Status; pulse?: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status]} ${pulse ? "animate-pulse-neon" : ""}`}
      aria-hidden="true"
    />
  );
}
