export type WorkflowRunLike = {
  workflow: string;
  createdAt: string;
  status: string;
  conclusion?: string | null;
};

export function pickWorkflowRun<T extends WorkflowRunLike>(
  runs: T[],
  filter: { workflowName?: string; dispatchedAfter?: number } = {}
): T | null {
  const { workflowName, dispatchedAfter = 0 } = filter;
  const needle = workflowName?.replace(/\.ya?ml$/i, "") ?? "";

  const candidates = runs.filter((run) => {
    const created = new Date(run.createdAt).getTime();
    if (dispatchedAfter && created < dispatchedAfter - 5000) return false;
    if (!needle) return true;
    return run.workflow.toLowerCase().includes(needle.toLowerCase());
  });

  const priority = (run: WorkflowRunLike) => {
    if (run.status === "in_progress" || run.status === "queued") return 0;
    if (run.status === "completed") return 1;
    return 2;
  };

  candidates.sort((a, b) => {
    const p = priority(a) - priority(b);
    if (p !== 0) return p;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return candidates[0] ?? null;
}
