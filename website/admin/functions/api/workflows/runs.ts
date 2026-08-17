import { GITHUB_REPO, verifyAdminRequest, jsonResponse } from "../_shared/auth.js";
import { githubFetch } from "../_shared/github.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const res = await githubFetch(
    `/repos/${GITHUB_REPO}/actions/runs?per_page=20&exclude_pull_requests=true`,
    env
  );
  if (!res.ok) {
    return jsonResponse({ error: "Failed to fetch workflow runs" }, 502);
  }

  const data = await res.json();
  const runs = (data.workflow_runs ?? []).map((run) => ({
    id: run.id,
    name: run.name,
    workflow: run.path?.replace(/^\.github\/workflows\//, "") ?? run.name,
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
    branch: run.head_branch,
    event: run.event,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  }));

  return jsonResponse({ runs, total: data.total_count ?? runs.length });
}
