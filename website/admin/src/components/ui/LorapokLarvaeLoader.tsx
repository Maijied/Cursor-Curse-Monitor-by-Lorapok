export type LarvaeLoaderSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<LarvaeLoaderSize, number> = {
  xs: 16,
  sm: 20,
  md: 32,
  lg: 48,
  xl: 72,
};

type LorapokLarvaeLoaderProps = {
  size?: LarvaeLoaderSize;
  label?: string;
  className?: string;
  /** Screen-reader text when no visible label */
  ariaLabel?: string;
};

/**
 * Animated Lorapok Larvae mascot — use for async actions (mail send, auth, deploy polling).
 */
export default function LorapokLarvaeLoader({
  size = "md",
  label,
  className = "",
  ariaLabel = "Loading",
}: LorapokLarvaeLoaderProps) {
  const px = SIZE_PX[size];

  return (
    <div
      className={`inline-flex flex-col items-center gap-2 ${className}`}
      role="status"
      aria-label={label ?? ariaLabel}
    >
      <svg
        width={px}
        height={px * 1.35}
        viewBox="0 0 64 88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="larvae-loader-root shrink-0"
        aria-hidden="true"
      >
        <ellipse className="larvae-trail" cx="32" cy="82" rx="18" ry="4" fill="#39ff14" opacity="0.2" />

        <g className="larvae-leg-left">
          <path d="M22 72 L16 82 M28 76 L22 86" stroke="#5b9dff" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
        </g>
        <g className="larvae-leg-right">
          <path d="M42 72 L48 82 M36 76 L42 86" stroke="#5b9dff" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
        </g>

        <ellipse className="larvae-segment larvae-segment-3" cx="32" cy="62" rx="22" ry="14" fill="#2d3748" stroke="#4a5568" strokeWidth="1" />
        <ellipse className="larvae-segment larvae-segment-2" cx="32" cy="46" rx="19" ry="13" fill="#374151" stroke="#4a5568" strokeWidth="1" />
        <ellipse className="larvae-segment larvae-segment-1" cx="32" cy="32" rx="16" ry="12" fill="#3d4a5c" stroke="#5b9dff" strokeWidth="0.8" />

        <path d="M24 38 Q32 44 40 38" stroke="#39ff14" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />

        <ellipse cx="26" cy="28" rx="7" ry="8" fill="#0a0e14" stroke="#39ff14" strokeWidth="0.8" />
        <ellipse cx="38" cy="28" rx="7" ry="8" fill="#0a0e14" stroke="#39ff14" strokeWidth="0.8" />
        <circle className="larvae-eye" cx="26" cy="28" r="4.5" fill="#39ff14" />
        <circle className="larvae-eye larvae-eye-right" cx="38" cy="28" r="4.5" fill="#39ff14" />
        <circle cx="24.5" cy="26.5" r="1.2" fill="white" opacity="0.9" />
        <circle cx="36.5" cy="26.5" r="1.2" fill="white" opacity="0.9" />
      </svg>
      {label && (
        <span className="text-sm text-[var(--color-muted)] text-center leading-snug">{label}</span>
      )}
    </div>
  );
}

type LarvaeLoaderPanelProps = {
  label?: string;
  className?: string;
  size?: LarvaeLoaderSize;
};

/** Centered loader block for page sections, Suspense fallbacks, and auth gates. */
export function LarvaeLoaderPanel({
  label = "Loading…",
  className = "",
  size = "lg",
}: LarvaeLoaderPanelProps) {
  return (
    <div
      className={`flex min-h-48 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-elevated)_80%,transparent)] p-8 ${className}`}
      role="status"
      aria-live="polite"
    >
      <LorapokLarvaeLoader size={size} label={label} />
    </div>
  );
}

type LarvaeLoaderOverlayProps = {
  open: boolean;
  label?: string;
};

/** Full-bleed overlay for in-flight operations (e.g. sending mail). */
export function LarvaeLoaderOverlay({ open, label = "Working…" }: LarvaeLoaderOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-bg-base)_75%,transparent)] backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LorapokLarvaeLoader size="lg" label={label} />
    </div>
  );
}
