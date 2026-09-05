import { useEffect, useState } from "react";
import { BookOpen, Info, Server } from "lucide-react";
import { fetchHealth } from "../lib/api";

const WIKI_ADMIN_PANEL =
  "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/docs/wiki/Admin-Panel.md";
const WIKI_ARCHITECTURE =
  "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/docs/wiki/Architecture.md";
const MASTER_TASKS =
  "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/plan/mission-control-master-tasks.md";

type InfraStatus = "ok" | "warn" | "off" | "loading";

function statusLabel(status: InfraStatus) {
  if (status === "ok") return "OK";
  if (status === "warn") return "Degraded";
  if (status === "loading") return "…";
  return "Off";
}

function statusClass(status: InfraStatus) {
  if (status === "ok") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "warn") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  if (status === "loading") return "bg-[var(--color-bg-base)] text-[var(--color-muted)] border-[var(--color-border)]";
  return "bg-[var(--color-bg-base)] text-[var(--color-muted)] border-[var(--color-border)]";
}

/**
 * Read-only login-side panel: auth policy, Firebase project, and live infra indicators (no secrets).
 */
export default function LoginInfraPanel() {
  const [loading, setLoading] = useState(true);
  const [firebaseProject, setFirebaseProject] = useState<string | null>(null);
  const [adminUrl, setAdminUrl] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [firebaseStatus, setFirebaseStatus] = useState<InfraStatus>("loading");
  const [mailStatus, setMailStatus] = useState<InfraStatus>("loading");
  const [d1Status, setD1Status] = useState<InfraStatus>("loading");
  const [githubStatus, setGithubStatus] = useState<InfraStatus>("loading");
  const [r2Status, setR2Status] = useState<InfraStatus>("loading");
  const [r2WriteTarget, setR2WriteTarget] = useState<"r2" | "kv">("kv");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const health = await fetchHealth();
        if (cancelled) return;

        setFirebaseProject(health.firebaseProject ?? null);
        setAdminUrl(health.adminPublicUrl ?? null);
        setCheckedAt(health.checks?.timestamp ?? new Date().toISOString());
        setFirebaseStatus(health.firebaseConfigured ? "ok" : "warn");
        setMailStatus(health.mailConfigured ? "ok" : "off");
        setD1Status(
          !health.adminD1Configured ? "off" : health.adminD1Ok ? "ok" : "warn",
        );
        setGithubStatus(health.checks?.github ? "ok" : "warn");
        const r2 = health.statsR2;
        if (!r2) {
          setR2Status("off");
        } else if (!r2.configured) {
          setR2Status("warn");
          setR2WriteTarget("kv");
        } else if (r2.ok) {
          setR2Status("ok");
          setR2WriteTarget("r2");
        } else {
          setR2Status("warn");
          setR2WriteTarget("kv");
        }
      } catch {
        if (!cancelled) {
          setFirebaseStatus("warn");
          setMailStatus("warn");
          setD1Status("warn");
          setGithubStatus("warn");
          setCheckedAt(new Date().toISOString());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const chips: { label: string; status: InfraStatus; detail?: string }[] = [
    { label: "Firebase", status: firebaseStatus },
    { label: "Mail", status: mailStatus },
    { label: "D1 logs", status: d1Status },
    { label: "GitHub", status: githubStatus },
    {
      label: "Stats R2",
      status: r2Status,
      detail: r2WriteTarget === "r2" ? "primary" : "KV fallback",
    },
  ];

  return (
    <aside
      className="glass-panel w-full max-w-md mt-4 p-4 sm:p-5 border border-[var(--color-border)] animate-fade-slide-up text-xs text-[var(--color-muted)]"
      aria-label="Mission Control login information"
    >
      <div className="flex items-start gap-2 mb-3">
        <Info size={16} className="shrink-0 text-[var(--color-accent-2)] mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-semibold text-[var(--color-text)] text-sm">Sign-in & infrastructure</p>
          <p className="mt-1 leading-relaxed">
            Mission Control is <strong className="text-[var(--color-text)]">invite-only</strong>. Your email must
            be on the admin allowlist before Google, magic link, or password sign-in succeeds.
          </p>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-wider font-medium mb-1.5">Auth methods</p>
        <ul className="flex flex-wrap gap-1.5">
          {["Google", "Magic link", "Password"].map((method) => (
            <li
              key={method}
              className="px-2 py-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-text)]"
            >
              {method}
            </li>
          ))}
        </ul>
      </div>

      <dl className="grid grid-cols-1 gap-2 mb-3">
        <div className="flex justify-between gap-3">
          <dt>Firebase project</dt>
          <dd className="text-[var(--color-text)] font-mono text-[11px] truncate max-w-[55%] text-right">
            {loading ? "…" : firebaseProject ?? "not configured"}
          </dd>
        </div>
        {adminUrl ? (
          <div className="flex justify-between gap-3">
            <dt>Admin URL</dt>
            <dd className="text-[var(--color-text)] font-mono text-[11px] truncate max-w-[55%] text-right">
              {adminUrl.replace(/^https?:\/\//, "")}
            </dd>
          </div>
        ) : null}
        {checkedAt ? (
          <div className="flex justify-between gap-3">
            <dt>Health checked</dt>
            <dd className="text-[11px]">{new Date(checkedAt).toLocaleString()}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1">
          <Server size={12} aria-hidden="true" />
          Live services
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {chips.map(({ label, status, detail }) => (
            <li
              key={label}
              className={`px-2 py-0.5 rounded-md border text-[11px] ${statusClass(status)}`}
            >
              {label}: {statusLabel(status)}
              {detail ? ` (${detail})` : ""}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[10px] text-[var(--color-muted)] leading-relaxed mb-3">
        R2 free tier: 10 GB storage, 1M Class A + 10M Class B ops/month. Stats badges fall back to KV when
        R2 is not bound.
      </p>

      <div className="pt-2 border-t border-[var(--color-border)] flex flex-wrap gap-3">
        <a
          href={WIKI_ADMIN_PANEL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-[var(--color-accent-2)] transition-colors"
        >
          <BookOpen size={12} aria-hidden="true" />
          Admin docs
        </a>
        <a
          href={WIKI_ARCHITECTURE}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-[var(--color-accent-2)] transition-colors"
        >
          Architecture
        </a>
        <a
          href={MASTER_TASKS}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-[var(--color-accent-2)] transition-colors"
        >
          Task registry
        </a>
      </div>
    </aside>
  );
}
