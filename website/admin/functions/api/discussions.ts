import { logAuthenticatedRequest } from "./_shared/activity-log.js";
import { GITHUB_REPO, jsonResponse, verifyAdminRequest } from "./_shared/auth.js";
import {
  createDiscussionPost,
  discussionsHomeUrl,
  fetchDiscussionCategories,
  manageCategoriesUrl,
} from "./_shared/github-graphql.js";

function capabilities(env) {
  return {
    canCreatePosts: Boolean(env.GITHUB_TOKEN),
    canManageCategories: false,
    canCreatePolls: false,
    tokenConfigured: Boolean(env.GITHUB_TOKEN),
  };
}

async function buildListPayload(env) {
  const headers = {
    Accept: "application/vnd.github+json",
    ...(env.GITHUB_TOKEN && { Authorization: `Bearer ${env.GITHUB_TOKEN}` }),
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
          id: d.node_id ?? String(d.id),
          title: d.title,
          url: d.html_url,
          category: d.category?.name ?? "General",
          categorySlug: d.category?.slug ?? "",
          createdAt: d.created_at,
          comments: d.comments ?? 0,
          answered: Boolean(d.answer_chosen_at),
          hasPoll: false,
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

  let categories = [];
  let repositoryId = null;
  if (env.GITHUB_TOKEN) {
    try {
      const cat = await fetchDiscussionCategories(env);
      categories = cat.categories;
      repositoryId = cat.repositoryId;
    } catch (err) {
      console.error("discussion categories", err);
    }
  }

  return {
    enabled,
    discussions,
    categories,
    repositoryId,
    topics: [...topicMap.values()].sort((a, b) => b.count - a.count),
    settingsUrl: `https://github.com/${GITHUB_REPO}/settings#features`,
    manageCategoriesUrl: manageCategoriesUrl(),
    discussionsUrl: discussionsHomeUrl(),
    repoIssuesUrl: `https://github.com/${GITHUB_REPO}/issues`,
    capabilities: capabilities(env),
  };
}

export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  try {
    const payload = await buildListPayload(env);
    const response = jsonResponse(payload);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  } catch (err) {
    console.error("discussions GET", err);
    return jsonResponse({ error: "Failed to load discussions" }, 502);
  }
}

export async function onRequestPost(context) {
  const startedAt = Date.now();
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  if (!env.GITHUB_TOKEN) {
    return jsonResponse({ error: "GITHUB_TOKEN not configured" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const title = String(body.title ?? "").trim();
  const markdown = String(body.body ?? "").trim();
  const categoryId = String(body.categoryId ?? "").trim();
  if (!title || !markdown || !categoryId) {
    return jsonResponse({ error: "title, body, and categoryId are required" }, 400);
  }

  try {
    let repositoryId = String(body.repositoryId ?? "").trim();
    if (!repositoryId) {
      const cat = await fetchDiscussionCategories(env);
      repositoryId = cat.repositoryId;
    }
    if (!repositoryId) {
      return jsonResponse({ error: "Could not resolve repository id" }, 502);
    }
    const discussion = await createDiscussionPost(env, {
      repositoryId,
      categoryId,
      title,
      body: markdown,
    });
    const response = jsonResponse({ ok: true, discussion });
    return logAuthenticatedRequest(context, auth, response, startedAt);
  } catch (err) {
    console.error("discussions POST", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Failed to create discussion" },
      502
    );
  }
}
