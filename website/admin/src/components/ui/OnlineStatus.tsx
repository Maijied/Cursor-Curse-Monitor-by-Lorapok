import { useEffect, useState } from "react";
import { fetchHealth } from "../../lib/api";
import StatusDot from "./StatusDot";

export default function OnlineStatus({ compact }: { compact?: boolean }) {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      fetchHealth()
        .then((h) => { if (!cancelled) setOnline(h.ok && h.checks.github); })
        .catch(() => { if (!cancelled) setOnline(false); });
    };

    check();
    const id = window.setInterval(check, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  if (online === null) return null;

  return (
    <span
      className={`inline-flex items-center gap-2 ${compact ? "text-xs" : "text-sm"} text-[var(--color-muted)]`}
      title={online ? "API online" : "API unreachable"}
    >
      <StatusDot status={online ? "ok" : "danger"} pulse={online} />
      {!compact && <span>{online ? "API online" : "API offline"}</span>}
    </span>
  );
}
