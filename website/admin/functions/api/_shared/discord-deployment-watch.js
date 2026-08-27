import { GITHUB_REPO } from "./auth.js";
import { githubFetch } from "./github.js";
import { pickWorkflowRun } from "./workflow-logs.js";
import { notifyDiscordDeployment } from "./discord-notify.js";
import { sortWorkflowJobs } from "./workflow-jobs.js";

const DEFAULT_WORKFLOW = "ci-cd.yml";
const POLL_MS = 5000;
const TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Delays execution for the specified duration.
 * @param {number} ms - The delay duration in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches recent non-pull-request workflow runs with normalized metadata.
 * @returns {Promise<Array<Object>>} The workflow runs, or an empty array when the request is unsuccessful.
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
 * Retrieves the jobs for a GitHub Actions workflow run.
 * @param {number|string} runId - The workflow run identifier.
 * @returns {Array<{name: string, status: string, conclusion: string|null}>} The workflow jobs sorted by execution status, or an empty array when the request fails.
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
 * Monitors the dispatched workflow until it completes, then sends a Discord completion notification.
 * @param {Record<string, unknown>} env - Environment configuration used to access GitHub and Discord.
 * @param {{
 *   actionType: string;
 *   tag?: string | null;
 *   channel?: string | null;
 *   market?: string | null;
 *   triggeredBy?: string | null;
 *   dispatchedAt?: number;
 *   workflowName?: string;
 * }} watch - Deployment metadata and workflow selection criteria.
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
 * Schedule monitoring for a Discord deployment completion.
 * @param {{ waitUntil?: (promise: Promise<unknown>) => void } | null | undefined} context - Optional execution context used to keep the monitoring task alive.
 * @param {Record<string, unknown>} env - Runtime environment configuration.
 * @param {Parameters<typeof watchDiscordDeploymentCompletion>[1]} watch - Deployment watch configuration.
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
