import { ShieldAlert } from "lucide-react";

type ReadOnlyAclBannerProps = {
  permission: string;
  feature?: string;
};

export default function ReadOnlyAclBanner({ permission, feature }: ReadOnlyAclBannerProps) {
  return (
    <div
      className="rounded-xl border border-[color-mix(in_srgb,var(--color-warn)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warn)_8%,transparent)] px-4 py-3 text-xs text-[var(--color-muted)] flex gap-2"
      role="status"
    >
      <ShieldAlert size={16} className="shrink-0 text-[var(--color-warn)] mt-0.5" aria-hidden="true" />
      <p>
        <span className="font-medium text-[var(--color-text)]">Read-only for your role.</span>
        {feature ? ` ${feature} requires` : " Requires"}{" "}
        <code className="text-[10px]">{permission}</code>. Contact the master admin if you need access.
      </p>
    </div>
  );
}
