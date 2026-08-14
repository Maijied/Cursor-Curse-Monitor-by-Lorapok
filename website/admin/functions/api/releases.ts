import { GITHUB_REPO, verifyAdminRequest, jsonResponse } from "./_shared/auth.js";
import { githubFetch } from "./_shared/github.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const res = await githubFetch(`/repos/${GITHUB_REPO}/releases?per_page=20`, env);
  if (!res.ok) {
    return jsonResponse({ error: "Failed to fetch releases" }, 502);
  }

  const data = await res.json();
  const releases = Array.isArray(data)
    ? data.map((r) => ({
        tag: r.tag_name,
        name: r.name,
        url: r.html_url,
        publishedAt: r.published_at,
        prerelease: r.prerelease,
        draft: r.draft,
        vsix: (r.assets ?? []).find((a) => a.name?.endsWith(".vsix")) ?? null,
      }))
    : [];

  return jsonResponse({ releases });
}
