import { GITHUB_REPO, verifyAdminRequest, jsonResponse } from "../_shared/auth.js";
import { githubFetch } from "../_shared/github.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const runId = url.searchParams.get("run_id");
  if (!runId) {
    return jsonResponse({ error: "run_id is required" }, 400);
  }

  const jobsRes = await githubFetch(`/repos/${GITHUB_REPO}/actions/runs/${runId}/jobs?per_page=20`, env);
  if (!jobsRes.ok) {
    return jsonResponse({ error: "Failed to fetch workflow jobs" }, 502);
  }

  const jobsData = await jobsRes.json();
  const jobs = (jobsData.jobs ?? []).map((job) => ({
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
  }));

  const logChunks = [];
  let logsUnavailable = false;

  for (const job of jobsData.jobs ?? []) {
    const logRes = await githubFetch(`/repos/${GITHUB_REPO}/actions/jobs/${job.id}/logs`, env, {
      redirect: "follow",
    });
    if (logRes.ok) {
      const text = await logRes.text();
      logChunks.push(`=== ${job.name} ===\n${text}`);
    } else {
      logsUnavailable = true;
      logChunks.push(`=== ${job.name} ===\n(log unavailable: HTTP ${logRes.status})`);
    }
  }

  if (logsUnavailable && logChunks.every((chunk) => chunk.includes("(log unavailable"))) {
    const runLogRes = await githubFetch(`/repos/${GITHUB_REPO}/actions/runs/${runId}/logs`, env, {
      redirect: "follow",
    });
    if (runLogRes.ok) {
      const archive = await runLogRes.text();
      logChunks.length = 0;
      logChunks.push(`=== Workflow run logs ===\n${archive}`);
      logsUnavailable = false;
    }
  }

  return jsonResponse({
    runId: Number(runId),
    jobs,
    text: logChunks.join("\n\n").slice(-120_000),
    logsUnavailable,
    logsHint: logsUnavailable
      ? "Logs need GITHUB_TOKEN with actions:read scope. Open the run in GitHub for full output."
      : undefined,
  });
}
