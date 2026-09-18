import { getPlatformAvailabilityStrip, type PlatformStripOverrides } from "@lorapok/cursor-monitor-shared";
import type { SiteData } from "../../lib/site-data";

function overridesFromSiteData(siteData: SiteData | null | undefined): PlatformStripOverrides {
  if (!siteData) return {};
  return {
    openVsx: siteData.ovsx?.url ?? null,
    vscode: siteData.vscode?.url ?? null,
    firefox: siteData.browserExtension?.firefox?.url ?? null,
    chrome: siteData.github?.chromeZipUrl ?? siteData.browserExtension?.chrome?.zipUrl ?? null,
    github: siteData.github?.releaseUrl ?? null,
  };
}

type Props = {
  siteData?: SiteData | null;
  className?: string;
};

/**
 * EXT-01 — compact platform availability strip (Open VSX, VS Code, Firefox, Chrome zip, GitHub).
 */
export default function PlatformAvailabilityStrip({ siteData, className = "" }: Props) {
  const items = getPlatformAvailabilityStrip("admin", overridesFromSiteData(siteData));

  return (
    <nav
      className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 ${className}`.trim()}
      aria-label="Platform availability"
    >
      {items.map((item, index) => (
        <span key={item.id} className="inline-flex items-center gap-x-1.5">
          {index > 0 ? (
            <span className="opacity-40 select-none" aria-hidden="true">
              ·
            </span>
          ) : null}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            title={item.label}
            className="hover:text-[var(--color-accent)] transition-colors"
          >
            {item.shortLabel}
          </a>
        </span>
      ))}
    </nav>
  );
}
