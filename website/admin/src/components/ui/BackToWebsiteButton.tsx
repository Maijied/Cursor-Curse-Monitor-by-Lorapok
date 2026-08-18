import { Globe } from "lucide-react";
import { MARKETING_SITE_URL } from "../../lib/marketing-site";

type Props = {
  className?: string;
  compact?: boolean;
};

export default function BackToWebsiteButton({ className = "", compact = false }: Props) {
  return (
    <a
      href={MARKETING_SITE_URL}
      target="_blank"
      rel="home noopener noreferrer"
      className={`group w-full flex items-center justify-center gap-2 px-4 py-2.5 min-h-11 text-sm font-medium rounded-xl transition-all border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-accent-2)] hover:bg-[color-mix(in_srgb,var(--color-accent-2)_8%,transparent)] hover:border-[color-mix(in_srgb,var(--color-accent-2)_35%,transparent)] ${className}`}
    >
      <Globe
        size={16}
        aria-hidden="true"
        className="shrink-0 transition-transform group-hover:-translate-y-px"
      />
      {compact ? "Website" : "Back to website"}
    </a>
  );
}
