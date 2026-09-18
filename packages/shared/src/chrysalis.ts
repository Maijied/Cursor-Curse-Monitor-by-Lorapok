/**
 * Chrysalis (CHRYS-01) — Lorapok floating AI brand + Larvae mascot shell.
 * Shared copy and SVG used by website, admin, and extension surfaces.
 */

export const CHRYSALIS_BRAND = {
  name: "Chrysalis",
  shortName: "Chrysalis",
  tagline: "Lorapok product guide",
  productLine: "Cursor Curse Monitor",
  org: "Lorapok Labs",
} as const;

export const CHRYSALIS_COPY = {
  panelTitle: `${CHRYSALIS_BRAND.name} · ${CHRYSALIS_BRAND.tagline}`,
  toggleAriaLabel: `Open ${CHRYSALIS_BRAND.name} product guide`,
  footerPublic:
    "Local session — Chrysalis uses site-data only. AI chat (BYOK) coming soon.",
  footerAdmin:
    "Operator session — Chrysalis stays within your RBAC. Secrets never enter chat.",
  offline: "Product data unavailable offline.",
  loading: "Loading…",
  contributeBlurb:
    "Want to help? Read CONTRIBUTING, grab a good-first issue, or follow Project #4.",
} as const;

/** Root element id for the marketing-site floating shell. */
export const CHRYSALIS_ROOT_ID = "ccm-chrysalis";

/** Legacy id kept for one release so old CSS/querySelectors keep working. */
export const CHRYSALIS_LEGACY_ROOT_ID = "ccm-floating-ai";

export const LARVAE_VIEWBOX = "0 0 64 88";

export type LarvaeSvgOptions = {
  width?: number;
  className?: string;
};

/**
 * Animated Larvae mascot SVG markup (pairs with larvae-loader.css / admin loader styles).
 */
export function larvaeSvgMarkup(options: LarvaeSvgOptions = {}): string {
  const width = Math.max(12, Math.round(options.width ?? 36));
  const height = Math.round(width * 1.35);
  const className = options.className?.trim() || "larvae-loader-root";
  return `<svg width="${width}" height="${height}" viewBox="${LARVAE_VIEWBOX}" fill="none" xmlns="http://www.w3.org/2000/svg" class="${className}" aria-hidden="true">
  <ellipse class="larvae-trail" cx="32" cy="82" rx="18" ry="4" fill="#39ff14" opacity="0.2"></ellipse>
  <g class="larvae-leg-left"><path d="M22 72 L16 82 M28 76 L22 86" stroke="#5b9dff" stroke-width="2.2" stroke-linecap="round" opacity="0.75"></path></g>
  <g class="larvae-leg-right"><path d="M42 72 L48 82 M36 76 L42 86" stroke="#5b9dff" stroke-width="2.2" stroke-linecap="round" opacity="0.75"></path></g>
  <ellipse class="larvae-segment larvae-segment-3" cx="32" cy="62" rx="22" ry="14" fill="#2d3748" stroke="#4a5568" stroke-width="1"></ellipse>
  <ellipse class="larvae-segment larvae-segment-2" cx="32" cy="46" rx="19" ry="13" fill="#374151" stroke="#4a5568" stroke-width="1"></ellipse>
  <ellipse class="larvae-segment larvae-segment-1" cx="32" cy="32" rx="16" ry="12" fill="#3d4a5c" stroke="#5b9dff" stroke-width="0.8"></ellipse>
  <path d="M24 38 Q32 44 40 38" stroke="#39ff14" stroke-width="2.2" stroke-linecap="round" opacity="0.8"></path>
  <ellipse cx="26" cy="28" rx="7" ry="8" fill="#0a0e14" stroke="#39ff14" stroke-width="0.8"></ellipse>
  <ellipse cx="38" cy="28" rx="7" ry="8" fill="#0a0e14" stroke="#39ff14" stroke-width="0.8"></ellipse>
  <circle class="larvae-eye" cx="26" cy="28" r="4.5" fill="#39ff14"></circle>
  <circle class="larvae-eye larvae-eye-right" cx="38" cy="28" r="4.5" fill="#39ff14"></circle>
  <circle cx="24.5" cy="26.5" r="1.2" fill="white" opacity="0.9"></circle>
  <circle cx="36.5" cy="26.5" r="1.2" fill="white" opacity="0.9"></circle>
</svg>`;
}

/**
 * Minimal Chrysalis shell DOM contract for non-React surfaces.
 */
export function chrysalisShellContract() {
  return {
    brand: CHRYSALIS_BRAND,
    copy: CHRYSALIS_COPY,
    rootId: CHRYSALIS_ROOT_ID,
    legacyRootId: CHRYSALIS_LEGACY_ROOT_ID,
    larvaeViewBox: LARVAE_VIEWBOX,
  };
}
