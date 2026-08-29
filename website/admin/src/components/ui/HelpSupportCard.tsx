import { ExternalLink, HelpCircle, Mail, MessageSquare } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import {
  ADMIN_PANEL_URL,
  GITHUB_ISSUES_URL,
  GITHUB_RELEASES_URL,
  PRODUCT_HOMEPAGE,
  SUPPORT_EMAIL,
} from "../../lib/product-links";

/**
 * Help, feedback, and beta-install guidance — aligned with Mission Control theme.
 */
export default function HelpSupportCard() {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("[Cursor Curse Monitor] Feedback")}`;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <HelpCircle size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Help & feedback
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1 max-w-xl">
            Extension users reach support by email or GitHub. Beta testers install the VSIX from GitHub
            pre-releases or enable pre-release on the marketplace listing.
          </p>
        </div>
        <Badge variant="synced">Public</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href={mailto}
          className="group flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-4 transition-all hover:border-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
        >
          <Mail size={18} className="mt-0.5 text-[var(--color-accent)] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-sm">Email support</p>
            <p className="text-xs text-[var(--color-muted)] mt-1 font-[family-name:var(--font-mono)] break-all">
              {SUPPORT_EMAIL}
            </p>
          </div>
          <ExternalLink
            size={14}
            className="ml-auto shrink-0 opacity-40 group-hover:opacity-100"
            aria-hidden="true"
          />
        </a>

        <a
          href={GITHUB_ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-4 transition-all hover:border-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
        >
          <MessageSquare size={18} className="mt-0.5 text-[var(--color-neon)] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-sm">GitHub issues</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">Bug reports and feature requests</p>
          </div>
          <ExternalLink
            size={14}
            className="ml-auto shrink-0 opacity-40 group-hover:opacity-100"
            aria-hidden="true"
          />
        </a>
      </div>

      <div className="mt-5 rounded-xl border border-dashed border-[var(--color-border)] p-4 bg-[color-mix(in_srgb,var(--color-accent)_4%,transparent)]">
        <p className="text-sm font-medium mb-2">Beta testing (IDE extension)</p>
        <ol className="text-xs text-[var(--color-muted)] space-y-2 list-decimal list-inside">
          <li>
            Run a <strong className="text-[var(--color-text)]">Beta (Pre-release)</strong> release from Deployments — marketplaces
            and GitHub get a pre-release automatically.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">VSIX sideload:</strong> download from{" "}
            <a href={GITHUB_RELEASES_URL} className="text-[var(--color-accent-2)] hover:underline" target="_blank" rel="noopener noreferrer">
              GitHub Releases
            </a>
            , then in Cursor/VS Code: Extensions → ⋯ → Install from VSIX.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">Marketplace pre-release:</strong> on the extension page, choose
            &quot;Install Pre-Release Version&quot; (VS Code / Open VSX only).
          </li>
        </ol>
        <p className="text-xs text-[var(--color-muted)] mt-3">
          Product site:{" "}
          <a href={PRODUCT_HOMEPAGE} className="text-[var(--color-accent-2)] hover:underline" target="_blank" rel="noopener noreferrer">
            {PRODUCT_HOMEPAGE}
          </a>
          {" · "}
          Admin:{" "}
          <a href={ADMIN_PANEL_URL} className="text-[var(--color-accent-2)] hover:underline" target="_blank" rel="noopener noreferrer">
            {ADMIN_PANEL_URL.replace(/^https:\/\//, "")}
          </a>
        </p>
      </div>
    </Card>
  );
}
