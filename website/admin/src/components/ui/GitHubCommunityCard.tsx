import { ExternalLink, GitBranch, GitPullRequest, Star, Eye, Copy } from "lucide-react";
import Card from "./Card";
import type { SiteData } from "../../lib/site-data";
import { formatCount } from "../../lib/site-data";

type Props = {
  data: SiteData;
};

/**
 * GitHub community snapshot: traffic, CI, issues, project board link.
 */
export default function GitHubCommunityCard({ data }: Props) {
  const gc = data.githubCommunity;
  if (!gc) return null;

  const traffic = gc.traffic;
  const ci = gc.ci;

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">GitHub community</h3>
          <p className="text-sm text-[var(--color-muted)]">
            Traffic &amp; CI snapshot · updated {gc.lastUpdated ?? "—"}
          </p>
        </div>
        <a
          href={gc.project?.url ?? "https://github.com/users/Maijied/projects/4"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-neon)] hover:underline"
        >
          Project #{gc.project?.number ?? 4}
          <ExternalLink size={14} />
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat icon={<Copy size={16} />} label="Clones (14d)" value={formatCount(traffic?.clones?.total)} />
        <Stat icon={<Eye size={16} />} label="Views (14d)" value={formatCount(traffic?.views?.total)} />
        <Stat icon={<GitPullRequest size={16} />} label="Open issues" value={formatCount(gc.openIssues)} />
        <Stat icon={<Star size={16} />} label="Stars" value={formatCount(gc.stars)} />
        <Stat icon={<GitBranch size={16} />} label="CI avg job" value={ci?.avgJobRunSeconds != null ? `${ci.avgJobRunSeconds}s` : "—"} />
        <Stat icon={<GitBranch size={16} />} label="CI fail rate" value={ci?.jobFailureRatePercent != null ? `${ci.jobFailureRatePercent}%` : "—"} />
      </div>

      {ci?.workflows?.length ? (
        <div className="text-xs text-[var(--color-muted)] border-t border-[var(--color-border)] pt-3">
          <p className="font-medium text-[var(--color-text)] mb-1">Workflows (current month)</p>
          <ul className="space-y-1">
            {ci.workflows.map((w) => (
              <li key={w.name}>
                <code className="text-[var(--color-neon)]">{w.name}</code> — {w.avgRunTime}, {w.failureRatePercent}% failures ({w.runs} runs)
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3">
      <div className="flex items-center gap-1.5 text-[var(--color-muted)] mb-1">{icon}<span className="text-xs">{label}</span></div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
