import { useEffect, useState } from "react";
import { Mail, RefreshCw } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import {
  fetchMailDeliverabilityApi,
  runMailDeliverabilityAuditApi,
  type MailDeliverabilityStatus,
} from "../../lib/api";
import { useAuthSession } from "../../lib/use-auth-session";

export default function MailDeliverabilityCard() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("integrations.write");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<MailDeliverabilityStatus | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = () =>
    fetchMailDeliverabilityApi()
      .then((data) => setStatus(data.status))
      .catch((err: Error) => setMessage({ type: "error", text: err.message }));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const handleRun = async () => {
    if (!canWrite) return;
    setRunning(true);
    setMessage(null);
    try {
      const data = await runMailDeliverabilityAuditApi();
      setStatus(data.status);
      setMessage({
        type: data.status.allOk ? "success" : "error",
        text: data.status.allOk
          ? `All ${data.status.addressCount} addresses passed.`
          : "Some addresses failed — review the matrix below.",
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Audit failed" });
    }
    setRunning(false);
  };

  const badge = status?.allOk
    ? { variant: "synced" as const, label: "All addresses OK" }
    : status?.lastRunAt
      ? { variant: "warn" as const, label: "Needs attention" }
      : { variant: "warn" as const, label: "Not audited" };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Mail size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Live email deliverability
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Verifies product, support, and provisioned identity addresses against transport and domain readiness.
          </p>
        </div>
        {status && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </div>

      {loading ? (
        <LorapokLarvaeLoader label="Loading deliverability matrix…" />
      ) : (
        <div className="space-y-4">
          {status?.lastVerifiedAt ? (
            <p className="text-xs text-[var(--color-muted)]">
              Last verified: {new Date(status.lastVerifiedAt).toLocaleString()}
            </p>
          ) : null}

          {status?.results?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                    <th className="py-2 pr-3">Address</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {status.results.map((row) => (
                    <tr key={row.address} className="border-b border-[var(--color-border)]/50">
                      <td className="py-2 pr-3 font-[family-name:var(--font-mono)] text-xs">{row.address}</td>
                      <td className="py-2 pr-3 text-[var(--color-muted)]">{row.source}</td>
                      <td className="py-2">
                        <Badge variant={row.ok ? "synced" : "danger"}>{row.ok ? "OK" : "Fail"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">No audit run yet.</p>
          )}

          {message ? <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} /> : null}

          {canWrite ? (
            <button
              type="button"
              onClick={() => void handleRun()}
              disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw size={14} aria-hidden="true" className={running ? "animate-spin" : ""} />
              {running ? "Running audit…" : "Run deliverability audit"}
            </button>
          ) : null}
        </div>
      )}
    </Card>
  );
}
