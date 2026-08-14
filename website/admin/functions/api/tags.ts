import { GITHUB_REPO, jsonResponse, verifyAdminRequest } from "./_shared/auth.js";
import { githubFetch } from "./_shared/github.js";
import { fetchSiteData, tagsFromSiteData } from "./_shared/site-data.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const res = await githubFetch(`/repos/${GITHUB_REPO}/tags?per_page=30`, env);

  if (res.ok) {
    const data = await res.json();
    const tags = Array.isArray(data) ? data.map((t) => t.name).filter(Boolean) : [];
    return jsonResponse({ tags, source: "github" }, 200);
  }

  try {
    const siteData = await fetchSiteData(env);
    const cached = tagsFromSiteData(siteData);
    if (cached.length > 0) {
      const warning =
        res.status === 403
          ? "GitHub API rate limit — using cached tags from site-data.json"
          : `GitHub tags ${res.status} — using cached tags from site-data.json`;
      return jsonResponse({ tags: cached, source: "cache", warning }, 200);
    }
  } catch {
    /* fall through */
  }

  return jsonResponse({ error: `Failed to fetch tags from GitHub (${res.status})` }, 502);
}
