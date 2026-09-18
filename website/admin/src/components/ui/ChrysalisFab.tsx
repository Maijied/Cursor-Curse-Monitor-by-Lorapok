import { useCallback, useEffect, useId, useState } from "react";
import {
  CHRYSALIS_BRAND,
  CHRYSALIS_COPY,
  GITHUB_CONTRIBUTING_URL,
  GITHUB_GOOD_FIRST_ISSUES_URL,
  GITHUB_PROJECT_BOARD_URL,
  larvaeSvgMarkup,
} from "@lorapok/cursor-monitor-shared";
import { useSiteData } from "../../hooks/useSiteData";

/**
 * Chrysalis floating shell for Mission Control (CHRYS-01).
 * Public product snapshot only — no admin KV or secrets in the panel.
 */
export default function ChrysalisFab() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const { data, loading } = useSiteData();

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onKeyDown]);

  const downloads = data?.downloads?.displayTotal ?? data?.downloads?.total;
  const version = data?.version ?? "—";

  return (
    <div className="fixed bottom-20 right-5 z-[80] font-sans md:bottom-6 md:right-[5.75rem]">
      {open ? (
        <div
          id={panelId}
          className="mb-3 w-[min(340px,calc(100vw-2rem))] max-h-[420px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-elevated)_96%,transparent)] shadow-2xl"
          role="dialog"
          aria-label={CHRYSALIS_COPY.panelTitle}
        >
          <div className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-text)]">
            {CHRYSALIS_COPY.panelTitle}
          </div>
          <div className="max-h-72 overflow-y-auto px-4 py-3 text-sm text-[var(--color-muted)] leading-relaxed">
            {loading ? (
              <p>{CHRYSALIS_COPY.loading}</p>
            ) : !data ? (
              <p>{CHRYSALIS_COPY.offline}</p>
            ) : (
              <>
                <p className="mb-3 text-[var(--color-text)]">
                  <strong>{CHRYSALIS_BRAND.name}</strong> shows the live public{" "}
                  <code className="text-xs">site-data.json</code> snapshot for operators.
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-[var(--color-muted)]">Version</dt>
                  <dd className="m-0 font-mono tabular-nums text-[var(--color-text)]">{version}</dd>
                  <dt className="text-[var(--color-muted)]">Downloads</dt>
                  <dd className="m-0 font-mono tabular-nums text-[var(--color-text)]">
                    {downloads != null ? Number(downloads).toLocaleString() : "—"}
                  </dd>
                  <dt className="text-[var(--color-muted)]">Open VSX</dt>
                  <dd className="m-0 font-mono tabular-nums text-[var(--color-text)]">
                    {data.ovsx?.version ?? "—"}
                  </dd>
                  <dt className="text-[var(--color-muted)]">VS Code</dt>
                  <dd className="m-0 font-mono tabular-nums text-[var(--color-text)]">
                    {data.vscode?.version ?? "—"}
                  </dd>
                </dl>
                <p className="mt-3 mb-0 text-[var(--color-text)]">{CHRYSALIS_COPY.contributeBlurb}</p>
                <p className="mt-2 mb-0 text-xs">
                  <a href={GITHUB_CONTRIBUTING_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)]">
                    CONTRIBUTING
                  </a>
                  {" · "}
                  <a href={GITHUB_GOOD_FIRST_ISSUES_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)]">
                    Good first issues
                  </a>
                  {" · "}
                  <a href={GITHUB_PROJECT_BOARD_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)]">
                    Project #4
                  </a>
                </p>
              </>
            )}
          </div>
          <div className="border-t border-[var(--color-border)] px-4 py-2 text-[0.72rem] text-[var(--color-muted)]">
            {CHRYSALIS_COPY.footerAdmin}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[color-mix(in_srgb,#39ff14_45%,#5b9dff)] bg-[radial-gradient(circle_at_30%_30%,#1a2332,#0a0e14_70%)] shadow-lg transition hover:border-[#39ff14]"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={CHRYSALIS_COPY.toggleAriaLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className="pointer-events-none"
          aria-hidden="true"
          dangerouslySetInnerHTML={{
            __html: larvaeSvgMarkup({ width: 32, className: "larvae-loader-root" }),
          }}
        />
      </button>
    </div>
  );
}
