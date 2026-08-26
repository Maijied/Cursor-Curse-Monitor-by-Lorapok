import { GITHUB_REPO } from "./auth.js";
import { githubFetch } from "./github.js";
import { pickWorkflowRun } from "./workflow-logs.js";
import { notifyDiscordDeployment } from "./discord-notify.js";
import { sortWorkflowJobs } from "./workflow-jobs.js";

const DEFAULT_WORKFLOW = "ci-cd.yml";
const POLL_MS = 5000;
const TIMEOUT_MS = 15 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {Record<string, unknown>} env
 */
async function fetchWorkflowRuns(env) {
  const res = await githubFetch(
    `/repos/${GITHUB_REPO}/actions/runs?per_page=20&exclude_pull_requests=true`,
    env
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.workflow_runs ?? []).map((run) => ({
    id: run.id,
    name: run.name,
    workflow: run.path?.replace(/^\.github\/workflows\//, "") ?? run.name,
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
    createdAt: run.created_at,
  }));
}

/**
 * @param {Record<string, unknown>} env
 * @param {number | string} runId
 */
async function fetchRunJobs(env, runId) {
  const jobsRes = await githubFetch(`/repos/${GITHUB_REPO}/actions/runs/${runId}/jobs?per_page=30`, env);
  if (!jobsRes.ok) return [];
  const jobsData = await jobsRes.json();
  return sortWorkflowJobs(
    (jobsData.jobs ?? []).map((job) => ({
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
    }))
  );
}

/**
 * Poll GitHub until the dispatched workflow completes, then post a Discord completion webhook.
 * @param {Record<string, unknown>} env
 * @param {{
 *   actionType: string;
 *   tag?: string | null;
 *   channel?: string | null;
 *   market?: string | null;
 *   triggeredBy?: string | null;
 *   dispatchedAt?: number;
 *   workflowName?: string;
 * }} watch
 */
export async function watchDiscordDeploymentCompletion(env, watch) {
  const startedAt = Date.now();
  const dispatchedAfter = watch.dispatchedAt ?? startedAt;
  const workflowName = watch.workflowName ?? DEFAULT_WORKFLOW;

  while (Date.now() - startedAt < TIMEOUT_MS) {
    try {
      const runs = await fetchWorkflowRuns(env);
      const match = pickWorkflowRun(runs, { workflowName, dispatchedAfter });

      if (match?.status === "completed") {
        const jobs = await fetchRunJobs(env, match.id);
        await notifyDiscordDeployment(env, {
          phase: "completed",
          actionType: watch.actionType,
          tag: watch.tag ?? null,
          channel: watch.channel ?? null,
          market: watch.market ?? null,
          conclusion: match.conclusion ?? "failure",
          runUrl: match.url,
          triggeredBy: watch.triggeredBy ?? null,
          jobs,
        });
        return;
      }
    } catch (error) {
      console.error("Discord deployment watch poll failed", error);
    }

    await sleep(POLL_MS);
  }

  console.warn("Discord deployment watch timed out without matching workflow completion", {
    actionType: watch.actionType,
    tag: watch.tag ?? null,
  });
}

/**
 * @param {{ waitUntil?: (promise: Promise<unknown>) => void } | null | undefined} context
 * @param {Record<string, unknown>} env
 * @param {Parameters<typeof watchDiscordDeploymentCompletion>[1]} watch
 */
export function scheduleDiscordDeploymentCompletionWatch(context, env, watch) {
  if (!watch?.actionType) return;
  const promise = watchDiscordDeploymentCompletion(env, {
    ...watch,
    dispatchedAt: watch.dispatchedAt ?? Date.now(),
  });
  if (context?.waitUntil) {
    context.waitUntil(promise);
    return;
  }
  promise.catch((error) => {
    console.error("Discord deployment watch failed", error);
  });
}
