import { useCallback, useState } from "react";
import { Play, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import LoadableButton from "../ui/LoadableButton";
import { API_CATALOG, API_CATALOG_GROUPS, type ApiCatalogEntry } from "../../lib/api-catalog";
import { probeApiEndpoint, type ApiProbeResult } from "../../lib/api";

type ProbeState = ApiProbeResult & { loading?: boolean; error?: string };

function statusVariant(status: number): "synced" | "warn" | "danger" | "neutral" {
  if (status >= 200 && status < 300) return "synced";
  if (status >= 400 && status < 500) return "warn";
  if (status >= 500) return "danger";
  return "neutral";
}

function methodColor(method: string) {
  const m = method.toUpperCase();
  if (m === "GET") return "text-[var(--color-accent-2)]";
  if (m === "POST") return "text-[var(--color-neon)]";
  if (m === "PUT") return "text-[var(--color-warn)]";
  if (m === "DELETE") return "text-[var(--color-danger)]";
  return "text-[var(--color-muted)]";
}

export default function ApiExplorer() {
  const [results, setResults] = useState<Record<string, ProbeState>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  const runProbe = useCallback(async (entry: ApiCatalogEntry) => {
    setResults((prev) => ({
      ...prev,
      [entry.id]: { ok: false, status: 0, latencyMs: 0, body: "", loading: true },
    }));
    try {
      const result = await probeApiEndpoint(entry.path, entry.method, {
        auth: entry.auth === "admin",
        body: entry.sampleBody ? JSON.stringify(entry.sampleBody) : undefined,
      });
      setResults((prev) => ({ ...prev, [entry.id]: result }));
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Probe failed";
      setResults((prev) => ({
        ...prev,
        [entry.id]: { ok: false, status: 0, latencyMs: 0, body: "", error: message },
      }));
      return null;
    }
  }, []);

  const runAllSafe = useCallback(async () => {
    setRunningAll(true);
    for (const entry of API_CATALOG.filter((e) => e.safeProbe)) {
      await runProbe(entry);
    }
    setRunningAll(false);
  }, [runProbe]);

  const probed = API_CATALOG.filter((e) => results[e.id] && !results[e.id].loading);
  const passing = probed.filter((e) => results[e.id]?.ok).length;

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="API Explorer"
        description="Probe Mission Control and public API routes. Nothing runs until you choose — use Test all safe or run an endpoint individually."
        action={
          <div className="flex flex-wrap gap-2">
            <LoadableButton
              type="button"
              onClick={runAllSafe}
              loading={runningAll}
              loadingLabel="Testing…"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--color-border)] hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Test all safe
            </LoadableButton>
            <Link
              to="/dashboard/logs"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"
            >
              View request log
            </Link>
          </div>
        }
      />

      <Card className="min-h-[5.5rem]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-[var(--color-text)]">Endpoint health</h3>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              {probed.length} of {API_CATALOG.length} probed · {passing} passing
            </p>
          </div>
          <Badge variant={passing === probed.length && probed.length > 0 ? "synced" : "warn"} pulse={passing === probed.length}>
            {probed.length ? `${passing}/${probed.length} OK` : "Running…"}
          </Badge>
        </div>
      </Card>

      {API_CATALOG_GROUPS.map((group) => {
        const entries = API_CATALOG.filter((entry) => entry.group === group);
        if (entries.length === 0) return null;
        return (
          <section key={group} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">{group}</h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {entries.map((entry) => {
                const state = results[entry.id];
                const isOpen = expanded === entry.id;
                return (
                  <Card key={entry.id} className="h-full min-h-[11rem] flex flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`font-[family-name:var(--font-mono)] text-sm font-semibold ${methodColor(entry.method)}`}>
                            {entry.method}
                          </span>
                          <code className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-text)] break-all">
                            {entry.path}
                          </code>
                        </div>
                        <p className="text-sm text-[var(--color-muted)]">{entry.description}</p>
                      </div>
                      <span className="shrink-0">
                        <Badge variant={entry.auth === "admin" ? "warn" : "neutral"}>{entry.auth}</Badge>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-auto pt-3 border-t border-[var(--color-border)]">
                      {state?.loading ? (
                        <span className="text-sm text-[var(--color-muted)]">Testing…</span>
                      ) : state ? (
                        <>
                          <Badge variant={state.error ? "danger" : statusVariant(state.status)}>
                            {state.error ? "Error" : state.status || "—"}
                          </Badge>
                          {state.latencyMs > 0 && (
                            <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-muted)]">
                              {state.latencyMs}ms
                            </span>
                          )}
                          {state.error && (
                            <span className="text-xs text-[var(--color-danger)] truncate">{state.error}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-[var(--color-muted)]">Not tested</span>
                      )}
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:ml-auto">
                        <button
                          type="button"
                          onClick={() => runProbe(entry)}
                          className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-lg text-xs font-semibold border border-[var(--color-border)] hover:bg-white/5"
                        >
                          <Play size={14} aria-hidden="true" />
                          Run
                        </button>
                        {state?.body && (
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : entry.id)}
                            className="inline-flex items-center justify-center gap-1 min-h-11 px-4 rounded-lg text-xs border border-[var(--color-border)] hover:bg-white/5"
                            aria-expanded={isOpen}
                          >
                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            Response
                          </button>
                        )}
                      </div>
                    </div>

                    {isOpen && state?.body && (
                      <pre className="mt-4 p-3 rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border)] text-xs font-[family-name:var(--font-mono)] text-[var(--color-text)] overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                        {state.body}
                      </pre>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
