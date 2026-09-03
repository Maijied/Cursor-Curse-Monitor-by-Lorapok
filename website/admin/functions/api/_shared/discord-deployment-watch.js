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
 * Dispatches a rollback deployment after a failed `publish-tag` deployment.
 * @param {Record<string, unknown>} env - Runtime configuration used for dispatching the rollback and sending notifications.
 * @param {Record<string, unknown>} watch - Deployment metadata, including the failed tag and rollback target.
 * @param {{ url?: string; conclusion?: string | null }} match - Matched workflow run metadata.
 */
async function maybeAutoRollbackOnFailure(env, watch, match) {
  if (match.conclusion !== "failure") return;
  const actionType = String(watch.actionType ?? "");
  if (!actionType.toLowerCase().includes("publish-tag")) return;

  const sourceTag = watch.rollbackSourceTag ? String(watch.rollbackSourceTag) : "";
  const failedTag = watch.tag ? String(watch.tag) : "";
  if (!sourceTag) {
    console.warn("Auto-rollback skipped: no rollback source tag");
    return;
  }
  if (sourceTag === failedTag) {
    console.warn("Auto-rollback skipped: source tag matches failed deploy tag");
    return;
  }

  const summary = `Auto-rollback to \`${sourceTag}\` after failed deploy of \`${failedTag}\`. CI will publish a new \`v{major}.{minor}.Rn\` rollback release.`;

  try {
    const { dispatchRollbackWorkflow } = await import("./deploy-workflow.js");
    const response = await dispatchRollbackWorkflow(
      env,
      {
        target_tag: sourceTag,
        publish_market: watch.market ?? "Open VSX + Firefox AMO",
        release_channel: watch.channel ?? "Production",
        deploy_admin: watch.deployAdmin ? "true" : "false",
        deploy_website: watch.deployWebsite !== false ? "true" : "false",
      },
      summary,
      { triggeredBy: "auto-rollback" },
      null
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Auto-rollback dispatch failed", response.status, detail);
      return;
    }
  } catch (error) {
    console.error("Auto-rollback dispatch failed", error);
    return;
  }
}

/**
 * Monitors the selected workflow run and sends a Discord notification when it completes.
 * @param {{
 *   actionType: string;
 *   tag?: string | null;
 *   channel?: string | null;
 *   market?: string | null;
 *   triggeredBy?: string | null;
 *   dispatchedAt?: number;
 *   workflowName?: string;
 * }} watch - Deployment metadata and criteria used to identify the workflow run.
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
        try {
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
        } catch (error) {
          console.error("Discord deployment completion notification failed", error);
        }
        await maybeAutoRollbackOnFailure(env, watch, match);
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
