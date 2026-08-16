import { logAuthenticatedRequest } from "./_shared/activity-log.js";
import { GITHUB_REPO, jsonResponse, verifyAdminRequest } from "./_shared/auth.js";

export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const githubToken = env.GITHUB_TOKEN;
  const headers = {
    Accept: "application/vnd.github+json",
    ...(githubToken && { Authorization: `Bearer ${githubToken}` }),
    "User-Agent": "Cloudflare-Pages",
  };

  const discussionsRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/discussions?per_page=15`,
    { headers }
  );

  let discussions = [];
  let enabled = discussionsRes.ok;
  if (enabled) {
    const data = await discussionsRes.json();
    discussions = Array.isArray(data)
      ? data.map((d) => ({
          title: d.title,
          url: d.html_url,
          category: d.category?.name ?? "General",
          createdAt: d.created_at,
          comments: d.comments ?? 0,
          answered: Boolean(d.answer_chosen_at),
        }))
      : [];
  }

  const issuesRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/issues?state=all&per_page=30&sort=updated`,
    { headers }
  );

  const topicMap = new Map();
  if (issuesRes.ok) {
    const issues = await issuesRes.json();
    for (const issue of issues) {
      if (issue.pull_request) continue;
      const labels = (issue.labels ?? [])
        .map((l) => (typeof l === "string" ? l : l.name))
        .filter(Boolean);
      const topic = labels[0] ?? "General";
      if (!topicMap.has(topic)) {
        topicMap.set(topic, { topic, count: 0, items: [] });
      }
      const entry = topicMap.get(topic);
      entry.count += 1;
      if (entry.items.length < 5) {
        entry.items.push({
          title: issue.title,
          url: issue.html_url,
          state: issue.state,
          comments: issue.comments ?? 0,
          updatedAt: issue.updated_at,
        });
      }
    }
  }

  const response = jsonResponse({
    enabled,
    discussions,
    topics: [...topicMap.values()].sort((a, b) => b.count - a.count),
    settingsUrl: `https://github.com/${GITHUB_REPO}/settings#features`,
    repoIssuesUrl: `https://github.com/${GITHUB_REPO}/issues`,
  });
  return logAuthenticatedRequest(context, auth, response, startedAt);
}
