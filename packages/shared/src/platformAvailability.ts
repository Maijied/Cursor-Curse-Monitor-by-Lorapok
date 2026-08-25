/**
 * Cross-platform availability copy and links for CCM IDE + browser surfaces.
 * Keep URLs in sync with website/site-data.json and marketplace listings.
 */

export type ProductSurface = "ide" | "browser";

export interface PlatformLink {
  id: string;
  label: string;
  shortLabel: string;
  url: string;
}

export const PRODUCT_HOMEPAGE = "https://cursor.lorapok.tech/";

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
    url: "https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor-by-lorapok/",
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

/** HTML paragraph for AMO / rich marketplace descriptions. */
export function formatAlsoAvailableHtml(surface: ProductSurface): string {
  const links = alsoAvailablePlatforms(surface)
    .map((p) => `<a href="${p.url}">${p.label}</a>`)
    .join(", ");
  return `<p><strong>Also available on:</strong> ${links}.</p>`;
}
