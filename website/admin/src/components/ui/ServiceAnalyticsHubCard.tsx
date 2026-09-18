import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Cloud, GitBranch, Mail, Store, XCircle, Shield } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import SectionReferLink from "./SectionReferLink";
import { SECTION_REFERS } from "../../lib/section-refer";
import { fetchServiceAnalyticsApi, type ServiceAnalyticsCard, type ServiceAnalyticsHub } from "../../lib/api";

function statusBadge(status: ServiceAnalyticsCard["status"]): "synced" | "warn" | "danger" | "neutral" {
  if (status === "ok") return "synced";
  if (status === "warn") return "warn";
  if (status === "danger") return "danger";
  return "neutral";
}

function CategoryIcon({ category }: { category: ServiceAnalyticsCard["category"] }) {
  const cls = "shrink-0 text-[var(--color-muted)]";
  switch (category) {
    case "cloudflare":
      return <Cloud size={16} className={cls} aria-hidden="true" />;
    case "google":
      return <Shield size={16} className={cls} aria-hidden="true" />;
    case "github":
      return <GitBranch size={16} className={cls} aria-hidden="true" />;
    case "mail":
      return <Mail size={16} className={cls} aria-hidden="true" />;
    case "marketplace":
      return <Store size={16} className={cls} aria-hidden="true" />;
    case "traffic":
      return <Activity size={16} className={cls} aria-hidden="true" />;
    default:
      return <CheckCircle2 size={16} className={cls} aria-hidden="true" />;
  }
}

function OverallIcon({ overall }: { overall: string }) {
  if (overall === "online") {
    return <CheckCircle2 size={18} className="text-[var(--color-ok)]" aria-hidden="true" />;
  }
  if (overall === "offline") {
    return <XCircle size={18} className="text-[var(--color-danger)]" aria-hidden="true" />;
  }
  return <AlertTriangle size={18} className="text-[var(--color-warn)]" aria-hidden="true" />;
}

/**
 * ANALYTICS-01 — operator service analytics hub (Cloudflare, Google, GitHub, Resend, marketplaces, traffic).
 */
export default function ServiceAnalyticsHubCard() {
  const [hub, setHub] = useState<ServiceAnalyticsHub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchServiceAnalyticsApi()
      .then((data) => setHub(data))
      .catch((err: unknown) => {
        setHub(null);
        setError(err instanceof Error ? err.message : "Failed to load service analytics");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-[var(--color-text)]">Service analytics hub</h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Aggregated operator metrics across Cloudflare, Firebase, GitHub, mail, marketplaces, and site traffic.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hub ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
              <OverallIcon overall={hub.overall} />
              <span className="capitalize">{hub.overall}</span>
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => load()}
            className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs hover:bg-white/5"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)] py-6">
          <LorapokLarvaeLoader size="xs" ariaLabel="Loading service analytics" />
          Loading service metrics…
        </div>
      ) : null}

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

      {!loading && hub ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {hub.cards.map((card) => (
            <article
              key={card.id}
              className="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-base)_55%,transparent)] p-3"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon category={card.category} />
                  <h4 className="text-sm font-medium text-[var(--color-text)] truncate">{card.label}</h4>
                </div>
                <Badge variant={statusBadge(card.status)}>{card.status}</Badge>
              </div>
              <p className="text-xs text-[var(--color-muted)] mb-3">{card.summary}</p>
              <dl className="space-y-1">
                {card.metrics.map((m) => (
                  <div key={m.label} className="flex justify-between gap-2 text-xs">
                    <dt className="text-[var(--color-muted)]">{m.label}</dt>
                    <dd className="text-[var(--color-text)] font-[family-name:var(--font-mono)] text-right truncate">
                      {m.value == null || m.value === "" ? "—" : String(m.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      ) : null}

      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <SectionReferLink {...SECTION_REFERS.settingsServices} />
        <SectionReferLink {...SECTION_REFERS.reports} label="Full status report" />
      </p>
    </Card>
  );
}
