export type WorkflowJob = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt?: string;
  completedAt?: string;
  steps?: Array<{ name: string; status: string; conclusion: string | null; number: number }>;
};

export type StepState = "success" | "failed" | "active" | "pending" | "skipped";

export const WORKFLOW_JOB_ORDER = [
  "Resolve Version (Live Marketplaces)",
  "Build & Validate (Root Extension)",
  "SEO & Metadata Pipeline",
  "Browser Extension CI",
  "Admin Panel CI",
  "Prepare Release Tag (push to main)",
  "Admin Deploy Gate",
  "Validate Dispatch Inputs",
  "Prepare & Tag Release",
  "Deploy to Marketplaces",
  "Deploy Admin Panel",
  "Deploy Marketing Website",
  "Test Results Summary",
] as const;

const JOB_ABBREVIATIONS: Record<string, string> = {
  "Resolve Version (Live Marketplaces)": "Resolve",
  "Build & Validate (Root Extension)": "Build",
  "SEO & Metadata Pipeline": "SEO",
  "Browser Extension CI": "Browser CI",
  "Admin Panel CI": "Admin CI",
  "Prepare Release Tag (push to main)": "Tag prep",
  "Admin Deploy Gate": "Admin gate",
  "Validate Dispatch Inputs": "Validate",
  "Prepare & Tag Release": "Release prep",
  "Deploy to Marketplaces": "Marketplaces",
  "Deploy Admin Panel": "Admin deploy",
  "Deploy Marketing Website": "Website",
  "Test Results Summary": "Summary",
};

export type MarketplaceTarget = {
  id: string;
  label: string;
  detail: string;
  stepName: string;
  state: StepState;
};

const MARKETPLACE_TARGETS = [
  {
    id: "vsce",
    label: "VS Code Marketplace",
    detail: "LorapokLabs extension listing",
    pattern: /^publish to vs code marketplace$/i,
  },
  {
    id: "ovsx-canonical",
    label: "Open VSX",
    detail: "lorapok-labs (canonical)",
    pattern: /^publish to open vsx \(canonical/i,
  },
  {
    id: "ovsx-duplicate",
    label: "Open VSX",
    detail: "LorapokLabs (legacy installs)",
    pattern: /^publish to open vsx \(lorapoklabs/i,
  },
  {
    id: "amo",
    label: "Firefox AMO",
    detail: "Signed XPI + review queue",
    pattern: /^publish to firefox add-ons/i,
  },
  {
    id: "github-release",
    label: "GitHub Release",
    detail: "VSIX, XPI, Chrome zip assets",
    pattern: /^create github release$/i,
  },
] as const;

export function sortWorkflowJobs<T extends { name: string }>(jobs: T[]): T[] {
  const order = new Map(WORKFLOW_JOB_ORDER.map((name, index) => [name, index]));
  return [...jobs].sort((a, b) => {
    const ai = order.get(a.name as (typeof WORKFLOW_JOB_ORDER)[number]) ?? 999;
    const bi = order.get(b.name as (typeof WORKFLOW_JOB_ORDER)[number]) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}

export function getJobStepState(job: Pick<WorkflowJob, "status" | "conclusion">): StepState {
  if (job.conclusion === "skipped") return "skipped";
  if (job.conclusion === "failure" || job.conclusion === "cancelled") return "failed";
  if (job.conclusion === "success") return "success";
  if (job.status === "in_progress") return "active";
  if (job.status === "queued") return "pending";
  return "pending";
}

export function getWorkflowStepState(step: { status: string; conclusion: string | null }): StepState {
  if (step.conclusion === "skipped") return "skipped";
  if (step.conclusion === "failure" || step.conclusion === "cancelled") return "failed";
  if (step.conclusion === "success") return "success";
  if (step.status === "in_progress") return "active";
  if (step.status === "queued") return "pending";
  return "pending";
}

export function getPipelineActiveIndex(jobs: WorkflowJob[]): number {
  if (!jobs.length) return 0;

  const inProgress = jobs.findIndex(
    (job) => job.conclusion !== "skipped" && job.status === "in_progress",
  );
  if (inProgress >= 0) return inProgress;

  const failed = jobs.findIndex(
    (job) => job.conclusion === "failure" || job.conclusion === "cancelled",
  );
  if (failed >= 0) return failed;

  const queued = jobs.findIndex(
    (job) =>
      job.conclusion !== "skipped" &&
      job.status === "queued" &&
      job.conclusion == null,
  );
  if (queued >= 0) return queued;

  const lastSuccess = jobs.reduce(
    (acc, job, index) => (job.conclusion === "success" ? index : acc),
    -1,
  );
  if (lastSuccess === jobs.length - 1) return lastSuccess;
  return Math.max(0, lastSuccess + 1);
}

export function shortJobName(name: string): string {
  return JOB_ABBREVIATIONS[name] ?? name;
}

export type PipelineSummary = {
  phase: "running" | "waiting" | "done" | "error";
  title: string;
  subtitle: string;
  activeJobName: string | null;
  activeIndex: number;
  total: number;
  completed: number;
  failed: number;
};

export function stepStateLabel(state: StepState): string {
  switch (state) {
    case "success":
      return "Done";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    case "active":
      return "Running";
    default:
      return "Waiting";
  }
}

/**
 * Human-readable headline for the deployment pipeline UI.
 */
export function getPipelineSummary(jobs: WorkflowJob[]): PipelineSummary | null {
  if (!jobs.length) return null;
  const sorted = sortWorkflowJobs(jobs);
  const total = sorted.length;
  const completed = sorted.filter((job) => job.conclusion === "success").length;
  const failed = sorted.filter(
    (job) => job.conclusion === "failure" || job.conclusion === "cancelled",
  ).length;
  const activeIndex = getPipelineActiveIndex(sorted);
  const activeJob = sorted[activeIndex] ?? null;
  const allDone = sorted.every((job) => job.status === "completed" || job.conclusion != null);

  if (failed > 0) {
    const failedJob = sorted.find(
      (job) => job.conclusion === "failure" || job.conclusion === "cancelled",
    );
    return {
      phase: "error",
      title: `Stopped at ${shortJobName(failedJob?.name ?? "pipeline step")}`,
      subtitle: failedJob?.name ?? "A workflow job failed or was cancelled.",
      activeJobName: failedJob?.name ?? null,
      activeIndex,
      total,
      completed,
      failed,
    };
  }

  if (allDone) {
    return {
      phase: "done",
      title: "Deployment finished",
      subtitle: `${completed} of ${total} jobs completed successfully.`,
      activeJobName: null,
      activeIndex,
      total,
      completed,
      failed,
    };
  }

  const activeState = activeJob ? getJobStepState(activeJob) : "pending";
  if (activeState === "active") {
    return {
      phase: "running",
      title: shortJobName(activeJob!.name),
      subtitle: activeJob!.name,
      activeJobName: activeJob!.name,
      activeIndex,
      total,
      completed,
      failed,
    };
  }

  return {
    phase: "waiting",
    title: shortJobName(activeJob?.name ?? "Next step"),
    subtitle: activeJob?.name ?? "Waiting for the next workflow job to start.",
    activeJobName: activeJob?.name ?? null,
    activeIndex,
    total,
    completed,
    failed,
  };
}

export function findMarketplaceJob(jobs: WorkflowJob[]): WorkflowJob | undefined {
  return jobs.find((job) => /deploy to marketplaces/i.test(job.name));
}

export function extractMarketplaceTargets(job: WorkflowJob | undefined): MarketplaceTarget[] {
  if (!job) return [];
  const steps = job.steps ?? [];

  return MARKETPLACE_TARGETS.map((target) => {
    const step = steps.find((item) => target.pattern.test(item.name.trim()));
    const state = step ? getWorkflowStepState(step) : steps.length > 0 ? "skipped" : "pending";
    return {
      id: target.id,
      label: target.label,
      detail: target.detail,
      stepName: step?.name ?? target.label,
      state,
    };
  }).filter((target) => target.state !== "skipped");
}

export function countMarketplaceProgress(targets: MarketplaceTarget[]) {
  const active = targets.filter((t) => t.state === "active").length;
  const done = targets.filter((t) => t.state === "success").length;
  const failed = targets.filter((t) => t.state === "failed").length;
  const pending = targets.filter((t) => t.state === "pending").length;
  return { active, done, failed, pending, total: targets.length };
}
