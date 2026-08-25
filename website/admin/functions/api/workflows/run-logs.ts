import { GITHUB_REPO, verifyAdminRequest, jsonResponse } from "../_shared/auth.js";
import { githubFetch } from "../_shared/github.js";
import { buildWorkflowLogText } from "../_shared/workflow-logs.js";
import { sortWorkflowJobs } from "../_shared/workflow-jobs.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const runId = url.searchParams.get("run_id");
  if (!runId) {
    return jsonResponse({ error: "run_id is required" }, 400);
  }

  const jobsRes = await githubFetch(`/repos/${GITHUB_REPO}/actions/runs/${runId}/jobs?per_page=30`, env);
  if (!jobsRes.ok) {
    return jsonResponse({ error: "Failed to fetch workflow jobs" }, 502);
  }

  const jobsData = await jobsRes.json();
  const jobs = sortWorkflowJobs(
    (jobsData.jobs ?? []).map((job) => ({
      id: job.id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      steps: (job.steps ?? []).map((step) => ({
        name: step.name,
        status: step.status,
        conclusion: step.conclusion,
        number: step.number,
      })),
    })),
  );

  const jobResults = [];
  for (const job of jobsData.jobs ?? []) {
    const logRes = await githubFetch(`/repos/${GITHUB_REPO}/actions/jobs/${job.id}/logs`, env, {
      redirect: "follow",
    });
    const body = logRes.ok ? await logRes.text() : "";
    jobResults.push({ name: job.name, status: logRes.status, body });
  }

  const { text, logsUnavailable, logsHint } = buildWorkflowLogText(jobResults);

  return jsonResponse({
    runId: Number(runId),
    jobs,
    text,
    logsUnavailable,
    logsHint,
  });
}
