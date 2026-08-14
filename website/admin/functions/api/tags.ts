import { GITHUB_REPO, jsonResponse, verifyAdminRequest } from "../_shared/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const githubToken = env.GITHUB_TOKEN;

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=30`, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      ...(githubToken && { Authorization: `Bearer ${githubToken}` }),
      "User-Agent": "Cloudflare-Pages",
    },
  });

  if (!res.ok) {
    console.error("GitHub tags fetch failed", res.status);
    return jsonResponse({ error: "Failed to fetch tags from GitHub" }, 502);
  }

  const data = await res.json();
  const tags = Array.isArray(data) ? data.map((t) => t.name).filter(Boolean) : [];

  return jsonResponse({ tags }, 200);
}
