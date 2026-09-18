/**
 * Cross-platform availability copy and links for CCM IDE + browser surfaces.
 * Keep URLs in sync with website/site-data.json and marketplace listings.
 */

export type ProductSurface = "ide" | "browser";

export type PlatformStripSurface = "website" | "admin" | "ide" | "browser";

export type PlatformStripId = "openVsx" | "vscode" | "firefox" | "chrome" | "github";

export interface PlatformLink {
  id: string;
  label: string;
  shortLabel: string;
  url: string;
}

/** One row in the EXT-01 platform availability strip. */
export interface PlatformStripItem {
  id: PlatformStripId;
  label: string;
  shortLabel: string;
  url: string;
  /** Optional live override path from site-data (documentation only). */
  siteDataHint?: string;
}

export const PRODUCT_HOMEPAGE = "https://cursor.lorapok.tech/";

export const AMO_PUBLIC_SLUG = "cursor-curse-monitor";
export const AMO_PUBLIC_URL = `https://addons.mozilla.org/en-US/firefox/addon/${AMO_PUBLIC_SLUG}/`;

export const PLATFORM_LINKS = {
  openVsx: {
    id: "openVsx",
    label: "Open VSX",
    shortLabel: "Open VSX",
    url: "https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok",
  },
  vscode: {
    id: "vscode",
    label: "VS Code Marketplace",
    shortLabel: "VS Code",
    url: "https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok",
  },
  firefox: {
    id: "firefox",
    label: "Firefox Add-ons",
    shortLabel: "Firefox",
    url: AMO_PUBLIC_URL,
  },
  chrome: {
    id: "chrome",
    label: "Chrome (direct zip)",
    shortLabel: "Chrome zip",
    url: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest",
  },
  github: {
    id: "github",
    label: "GitHub Releases",
    shortLabel: "GitHub",
    url: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases",
  },
  website: {
    id: "website",
    label: "Product website",
    shortLabel: "Website",
    url: PRODUCT_HOMEPAGE,
  },
} as const satisfies Record<string, PlatformLink>;

const STRIP_ORDER: PlatformStripId[] = ["openVsx", "vscode", "firefox", "chrome", "github"];

const STRIP_BY_SURFACE: Record<PlatformStripSurface, PlatformStripId[]> = {
  website: STRIP_ORDER,
  admin: STRIP_ORDER,
  ide: STRIP_ORDER,
  browser: STRIP_ORDER,
};

/**
 * Live URL overrides from site-data / product context.
 * Prefer chromeZipUrl for the Chrome row when present.
 */
export type PlatformStripOverrides = Partial<Record<PlatformStripId, string | null | undefined>>;

function toStripItem(id: PlatformStripId, overrides?: PlatformStripOverrides): PlatformStripItem {
  const base = PLATFORM_LINKS[id];
  const override = overrides?.[id];
  const url = typeof override === "string" && override.trim() ? override.trim() : base.url;
  return {
    id,
    label: base.label,
    shortLabel: base.shortLabel,
    url,
    siteDataHint:
      id === "chrome"
        ? "github.chromeZipUrl"
        : id === "openVsx"
          ? "ovsx.url"
          : id === "vscode"
            ? "vscode.url"
            : id === "firefox"
              ? "browserExtension.firefox.url"
              : "github.releaseUrl",
  };
}

/**
 * EXT-01 — platform availability strip (logos/links rendered by each surface).
 */
export function getPlatformAvailabilityStrip(
  surface: PlatformStripSurface = "website",
  overrides?: PlatformStripOverrides
): PlatformStripItem[] {
  const ids = STRIP_BY_SURFACE[surface] ?? STRIP_ORDER;
  return ids.map((id) => toStripItem(id, overrides));
}

/** Compact HTML for webviews / static footers (no framework). */
export function formatPlatformStripHtml(
  surface: PlatformStripSurface = "website",
  overrides?: PlatformStripOverrides,
  className = "platform-strip"
): string {
  const items = getPlatformAvailabilityStrip(surface, overrides);
  const links = items
    .map(
      (item) =>
        `<a class="${className}-link" href="${escapeHtmlAttr(item.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtmlAttr(item.label)}">${escapeHtmlText(item.shortLabel)}</a>`
    )
    .join(`<span class="${className}-sep" aria-hidden="true">·</span>`);
  return `<nav class="${className}" aria-label="Platform availability">${links}</nav>`;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Platforms to promote from each product surface (excludes self). */
export function alsoAvailablePlatforms(surface: ProductSurface): PlatformLink[] {
  switch (surface) {
    case "ide":
      return [
        PLATFORM_LINKS.vscode,
        PLATFORM_LINKS.firefox,
        PLATFORM_LINKS.chrome,
        PLATFORM_LINKS.github,
        PLATFORM_LINKS.website,
      ];
    case "browser":
      return [
        PLATFORM_LINKS.openVsx,
        PLATFORM_LINKS.vscode,
        PLATFORM_LINKS.github,
        PLATFORM_LINKS.website,
      ];
    default:
      return [];
  }
}

/** One-line marketplace cross-link for listings and footers. */
export function formatAlsoAvailableOn(surface: ProductSurface): string {
  const labels = alsoAvailablePlatforms(surface).map((p) => p.label);
  if (!labels.length) return "";
  if (labels.length === 1) return `This app is also available on ${labels[0]}.`;
  const last = labels.pop();
  return `This app is also available on ${labels.join(", ")}, and ${last}.`;
}

/** Markdown paragraph for AMO listing (Extension Workshop markdown). */
export function formatAlsoAvailableMarkdown(surface: ProductSurface): string {
  const links = alsoAvailablePlatforms(surface)
    .map((p) => `[${p.label}](${p.url})`)
    .join(", ");
  return `**Also available on:** ${links}.`;
}
