import { ExternalLink, Store } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import { useSiteData } from "../../hooks/useSiteData";

const LINKS = {
  openVsx: "https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok",
  vsMarketplace:
    "https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok",
  amo: "https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor-by-lorapok/",
  github: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases",
};

export default function MarketplaceConfigCard() {
  const { data: siteData } = useSiteData();
  const ext = siteData?.browserExtension;
  const ide = siteData?.vscodeExtension;

  return (
    <Card>
      <div className="mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Store size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
          Marketplaces & distribution
        </h3>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Read-only status from <code className="text-xs">site-data.json</code>. Publishing uses CI (AMO sign, Open VSX,
          GitHub Releases) — configure tokens under GitHub and cred vault locally.
        </p>
      </div>

      <dl className="space-y-4 text-sm">
        <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
          <div className="flex justify-between items-center gap-2">
            <dt className="font-medium">IDE extension (Open VSX / VS Marketplace)</dt>
            <Badge variant={ide?.published ? "synced" : "warn"}>
              {ide?.published ? `v${ide.version ?? ext?.version ?? "—"}` : "Check CI"}
            </Badge>
          </div>
          <dd className="text-[var(--color-muted)] text-xs">
            Downloads: {ide?.downloads ?? siteData?.stats?.vscodeDownloads ?? "—"}
          </dd>
          <dd className="flex flex-wrap gap-3 pt-1">
            <a href={LINKS.openVsx} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-accent-2)] hover:underline inline-flex items-center gap-1">
              Open VSX <ExternalLink size={12} />
            </a>
            <a href={LINKS.vsMarketplace} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-accent-2)] hover:underline inline-flex items-center gap-1">
              VS Marketplace <ExternalLink size={12} />
            </a>
          </dd>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
          <div className="flex justify-between items-center gap-2">
            <dt className="font-medium">Firefox AMO</dt>
            <Badge variant={ext?.firefox?.published ? "synced" : "warn"}>
              {ext?.firefox?.published ? `v${ext.version ?? "—"} live` : "Pending / zip only"}
            </Badge>
          </div>
          <dd className="text-[var(--color-muted)] text-xs">JWT signing via CI — vault keys under firefox/jwt_*</dd>
          <dd>
            <a href={LINKS.amo} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-accent-2)] hover:underline inline-flex items-center gap-1">
              AMO listing <ExternalLink size={12} />
            </a>
          </dd>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
          <div className="flex justify-between items-center gap-2">
            <dt className="font-medium">Chrome extension</dt>
            <Badge variant="warn">Direct zip — not in Web Store</Badge>
          </div>
          <dd className="text-[var(--color-muted)] text-xs">Artifact from browser-ext CI; no store publish yet.</dd>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
          <div className="flex justify-between items-center gap-2">
            <dt className="font-medium">GitHub Releases</dt>
            <Badge variant="synced">CI full-release</Badge>
          </div>
          <dd>
            <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-accent-2)] hover:underline inline-flex items-center gap-1">
              Releases <ExternalLink size={12} />
            </a>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
