import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Shield } from "lucide-react";

type NotFoundProps = {
  /** Rendered inside authenticated dashboard shell */
  inApp?: boolean;
};

export default function NotFound({ inApp = false }: NotFoundProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname + location.search;

  const showAdminHint = useMemo(() => {
    const lower = location.pathname.toLowerCase();
    return !inApp && /^\/(login|dashboard|admin|mission-control)(\/|$)/.test(lower);
  }, [inApp, location.pathname]);

  return (
    <div className={`relative flex flex-col items-center justify-center text-center animate-fade-slide-up ${inApp ? "min-h-[60vh] py-8" : "min-h-screen px-4 py-12"}`}>
      {!inApp && <div className="app-shell-bg fixed inset-0" aria-hidden="true" />}

      <div className={`relative z-10 w-full max-w-lg ${inApp ? "" : "glass-panel p-6 sm:p-10"}`}>
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-4">
          <span className="w-2 h-2 rounded-full bg-[var(--color-warn)] animate-pulse" aria-hidden="true" />
          Signal lost
        </p>

        <h1
          className="text-[clamp(4rem,16vw,6.5rem)] font-bold font-[family-name:var(--font-mono)] leading-none mb-2 bg-gradient-to-br from-[var(--color-accent-2)] via-[var(--color-accent)] to-[var(--color-neon)] bg-clip-text text-transparent"
          aria-label="Error 404"
        >
          404
        </h1>

        <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-text)] mb-3">
          {inApp ? "This dashboard page doesn’t exist" : "Page not found"}
        </h2>

        <p className="text-sm text-[var(--color-muted)] mb-4">
          <code className="font-[family-name:var(--font-mono)] text-xs break-all text-[var(--color-accent-2)]">{path}</code>
        </p>

        {showAdminHint && (
          <p className="text-sm text-[var(--color-muted)] mb-6 p-3 rounded-xl border border-[color-mix(in_srgb,var(--color-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]">
            Mission Control lives at{" "}
            <a href="https://cursor-dev.lorapok.tech/login" className="text-[var(--color-accent)] font-medium hover:underline">
              cursor-dev.lorapok.tech/login
            </a>
            .
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(inApp ? "/dashboard" : "/login"))}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl text-sm font-semibold border border-[var(--color-border)] hover:bg-white/5"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Go back
          </button>
          {inApp ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl text-sm font-semibold bg-[var(--color-accent)] text-white hover:opacity-90"
            >
              <Home size={16} aria-hidden="true" />
              Overview
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl text-sm font-semibold bg-[var(--color-accent)] text-white hover:opacity-90"
              >
                <Shield size={16} aria-hidden="true" />
                Admin login
              </Link>
              <a
                href="https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/"
                className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl text-sm font-semibold border border-[var(--color-border)] hover:bg-white/5"
              >
                <Home size={16} aria-hidden="true" />
                Marketing site
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
