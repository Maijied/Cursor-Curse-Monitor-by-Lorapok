import { ExternalLink, MessageSquare, MessagesSquare } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import { useDiscussions } from "../../hooks/useDiscussions";
import { useSiteData } from "../../hooks/useSiteData";

export default function Discussions() {
  const { data: siteData } = useSiteData();
  const fallback = siteData?.community
    ? {
        enabled: siteData.community.discussionsEnabled,
        discussions: siteData.community.discussions,
        topics: siteData.community.topics,
        settingsUrl: siteData.community.settingsUrl,
        repoIssuesUrl: siteData.community.repoIssuesUrl,
      }
    : undefined;

  const { data, error, loading } = useDiscussions(fallback);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <ShimmerSkeleton className="h-16" />
        <ShimmerSkeleton className="h-48" />
      </div>
    );
  }

  if (error && !data) {
    return <ErrorState message={error} />;
  }

  if (!data) return null;

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Community"
        description="GitHub Discussions and issue topics for support, feedback, and roadmap."
        action={
          data.enabled ? (
            <Badge variant="synced" pulse>Discussions enabled</Badge>
          ) : (
            <Badge variant="warn">Discussions disabled</Badge>
          )
        }
      />

      {!data.enabled && (
        <Card className="border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)]">
          <h3 className="font-semibold text-[var(--color-text)] mb-2">Enable GitHub Discussions</h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Discussions are not enabled on this repo yet. Enable them to host Q&amp;A, ideas, and announcements in separate categories.
          </p>
          <a
            href={data.settingsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-accent-2)] hover:underline"
          >
            Open repository settings
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </Card>
      )}

      {data.discussions.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <MessagesSquare size={20} className="text-[var(--color-accent)]" aria-hidden="true" />
            Recent discussions
          </h3>
          <ul className="divide-y divide-[var(--color-border)]">
            {data.discussions.map((d) => (
              <li key={d.url} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]">
                    {d.title}
                  </a>
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    {d.category} · {d.comments} comments · {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {d.answered && <Badge variant="synced">Answered</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
          <MessageSquare size={20} className="text-[var(--color-neon)]" aria-hidden="true" />
          Topics from issues
        </h3>
        {data.topics.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No labeled issues yet.{" "}
            <a href={data.repoIssuesUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent-2)] hover:underline">
              View issues on GitHub
            </a>
          </p>
        ) : (
          <div className="space-y-6">
            {data.topics.map((topic) => (
              <div key={topic.topic}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="neutral">{topic.topic}</Badge>
                  <span className="text-xs text-[var(--color-muted)]">{topic.count} issue{topic.count !== 1 ? "s" : ""}</span>
                </div>
                <ul className="space-y-2 pl-1">
                  {topic.items.map((item) => (
                    <li key={item.url}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--color-text)] hover:text-[var(--color-accent)] flex items-center gap-2"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${item.state === "open" ? "bg-[var(--color-neon)]" : "bg-[var(--color-muted)]"}`} />
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
