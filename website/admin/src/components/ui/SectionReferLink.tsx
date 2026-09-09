import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { resolveSectionRefer, type SectionReferTarget } from "../../lib/section-refer";
import { persistSettingsTab } from "./settings-tab-storage";

type SectionReferLinkProps = SectionReferTarget & {
  className?: string;
};

/**
 * Minimal cross-section navigation — "Go to {destination} →".
 * Use when help copy mentions another Mission Control area.
 */
export default function SectionReferLink({
  section,
  settingsTab,
  label,
  className = "",
}: SectionReferLinkProps) {
  const resolved = resolveSectionRefer({ section, settingsTab, label });

  const handleClick = () => {
    if (section === "settings" && resolved.settingsTab) {
      persistSettingsTab(resolved.settingsTab);
    }
  };

  return (
    <Link
      to={resolved.path}
      onClick={handleClick}
      className={`inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline shrink-0 ${className}`}
    >
      <span>Go to {resolved.label}</span>
      <ArrowRight size={12} aria-hidden="true" className="opacity-80" />
    </Link>
  );
}
