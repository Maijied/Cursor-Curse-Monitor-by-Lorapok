import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import { auth } from "../../lib/firebase";
import { fetchHealth } from "../../lib/api";

type ServiceStatus = "connected" | "disconnected" | "checking";

type ServiceRow = {
  id: string;
  label: string;
  status: ServiceStatus;
  detail: string;
};

function StatusIcon({ status }: { status: ServiceStatus }) {
  if (status === "checking") {
    return <Loader2 size={16} className="animate-spin text-[var(--color-muted)]" aria-hidden="true" />;
  }
  if (status === "connected") {
    return <CheckCircle2 size={16} className="text-[var(--color-ok)]" aria-hidden="true" />;
  }
  return <XCircle size={16} className="text-[var(--color-danger)]" aria-hidden="true" />;
}

export default function ConnectedServicesCard() {
  const [services, setServices] = useState<ServiceRow[]>([
    { id: "firebase", label: "Firebase Auth", status: "checking", detail: "Checking session…" },
    { id: "github", label: "GitHub API", status: "checking", detail: "Checking API…" },
    { id: "mail", label: "Outbound mail", status: "checking", detail: "Checking mail transport…" },
    { id: "site-data", label: "Site data feed", status: "checking", detail: "Checking site-data.json…" },
    { id: "notice", label: "Development notice", status: "checking", detail: "Checking notice config…" },
  ]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const next: ServiceRow[] = [];

      const user = auth.currentUser;
      next.push({
        id: "firebase",
        label: "Firebase Auth",
        status: user ? "connected" : "disconnected",
        detail: user?.email ?? "Not signed in",
      });

      try {
        const health = await fetchHealth();
        next.push({
          id: "github",
          label: "GitHub API",
          status: health.checks.github ? "connected" : "disconnected",
          detail: health.checks.github
            ? `OK · ${new Date(health.checks.timestamp).toLocaleString()}`
            : "API unreachable",
        });
        next.push({
          id: "mail",
          label: "Outbound mail",
          status: health.mailConfigured ? "connected" : "disconnected",
          detail: health.mailConfigured
            ? String(health.mailTransport ?? "configured")
            : health.mailHint ?? "Mail transport not configured",
        });
      } catch {
        next.push({
          id: "github",
          label: "GitHub API",
          status: "disconnected",
          detail: "Health check failed",
        });
        next.push({
          id: "mail",
          label: "Outbound mail",
          status: "disconnected",
          detail: "Health check failed",
        });
      }

      try {
        const res = await fetch("/site-data.json", { cache: "no-store" });
        if (!res.ok) throw new Error("unavailable");
        const data = await res.json();
        next.push({
          id: "site-data",
          label: "Site data feed",
          status: "connected",
          detail: `v${data.version} · ${new Date(data.generatedAt).toLocaleString()}`,
        });
        next.push({
          id: "notice",
          label: "Development notice",
          status: data.notice?.enabled ? "connected" : "disconnected",
          detail: data.notice?.enabled
            ? `${data.notice.title} · active`
            : "Notice disabled in site-data",
        });
      } catch {
        next.push({
          id: "site-data",
          label: "Site data feed",
          status: "disconnected",
          detail: "site-data.json unavailable",
        });
        next.push({
          id: "notice",
          label: "Development notice",
          status: "disconnected",
          detail: "Cannot read notice from site-data",
        });
      }

      if (!cancelled) setServices(next);
    }

    check();
    const interval = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const connectedCount = services.filter((s) => s.status === "connected").length;

  return (
    <Card className="h-full min-h-[18rem] flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[var(--color-text)]">Connected Services</h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Live connectivity between admin, APIs, and the public site feed.
          </p>
        </div>
        <Badge variant={connectedCount === services.length ? "synced" : "warn"} pulse={connectedCount === services.length}>
          {connectedCount}/{services.length} connected
        </Badge>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm" aria-label="Connected services status">
          <thead>
            <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
              <th scope="col" className="pb-3 pr-4 font-medium w-10"><span className="sr-only">Status</span></th>
              <th scope="col" className="pb-3 pr-4 font-medium">Service</th>
              <th scope="col" className="pb-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {services.map((service) => (
              <tr key={service.id} className="hover:bg-white/[0.02]">
                <td className="py-3 pr-4">
                  <StatusIcon status={service.status} />
                  <span className="sr-only">{service.status}</span>
                </td>
                <th scope="row" className="py-3 pr-4 font-medium text-[var(--color-text)] text-left">
                  {service.label}
                </th>
                <td className="py-3 text-[var(--color-muted)] text-xs sm:text-sm">{service.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-[var(--color-muted)] mt-6 pt-4 border-t border-[var(--color-border)]">
        Need full endpoint tests?{" "}
        <Link to="/dashboard/api-explorer" className="text-[var(--color-accent)] font-medium hover:underline">
          Open API Explorer
        </Link>
      </p>
    </Card>
  );
}
