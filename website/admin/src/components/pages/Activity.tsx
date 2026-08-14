import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import { fetchWorkflowRuns, type WorkflowRun } from "../../lib/api";

function runBadge(run: WorkflowRun) {
  if (run.conclusion === "success") return "synced" as const;
  if (run.conclusion === "failure") return "danger" as const;
  if (run.status === "in_progress") return "warn" as const;
  return "neutral" as const;
}

export default function Activity() {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkflowRuns()
      .then((data) => { setRuns(data.runs ?? []); setError(null); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ShimmerSkeleton className="h-64" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader title="Activity Log" description="Recent GitHub Actions workflow runs." />
      <Card>
        <ul className="divide-y divide-[var(--color-border)]">
          {runs.map((run) => (
            <li key={run.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[var(--color-text)]">{run.name}</span>
                  <Badge variant={runBadge(run)}>{run.conclusion ?? run.status}</Badge>
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  {run.workflow} · {run.branch} · {run.event} · {new Date(run.createdAt).toLocaleString()}
                </p>
              </div>
              <a href={run.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--color-accent-2)] hover:underline">
                View run <ExternalLink size={14} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
