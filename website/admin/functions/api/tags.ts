import { logAuthenticatedRequest } from "./_shared/activity-log.js";
import { GITHUB_REPO, jsonResponse, verifyAdminRequest } from "./_shared/auth.js";
import { githubFetch } from "./_shared/github.js";
import { fetchSiteData, liveTagFromSiteData, tagsFromSiteData } from "./_shared/site-data.js";
import { enrichTags, filterPublishableTags } from "./_shared/publishable-tags.js";

async function buildTagsPayload(env, rawTags, source, warning, siteDataOverride) {
  let liveTag = null;
  try {
    const siteData = siteDataOverride ?? (await fetchSiteData(env));
    liveTag = liveTagFromSiteData(siteData);
  } catch {
    /* liveTag stays null */
  }
  const enriched = enrichTags(filterPublishableTags(rawTags), liveTag);
  return { ...enriched, source, ...(warning ? { warning } : {}) };
}

/**
 * Retrieves repository tags for an authenticated administrative request.
 *
 * Falls back to cached site data when GitHub is unavailable and returns a gateway error when neither source provides tags.
 *
 * @param context - The request context containing the incoming request and environment bindings
 * @returns The HTTP response containing the tags payload or an error
 */
export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const res = await githubFetch(`/repos/${GITHUB_REPO}/tags?per_page=100`, env);

  if (res.ok) {
    const data = await res.json();
    const tagNames = Array.isArray(data) ? data.map((t) => t.name).filter(Boolean) : [];
    const payload = await buildTagsPayload(env, tagNames, "github");
    const response = jsonResponse(payload, 200);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  try {
    const siteData = await fetchSiteData(env);
    const cached = tagsFromSiteData(siteData);
    if (cached.length > 0) {
      const warning =
        res.status === 401
          ? "GITHUB_TOKEN on Mission Control is invalid or expired — using cached tags from site-data.json. Run: npm run github:sync-vault --prefix website/admin"
          : res.status === 403
            ? "GitHub API rate limit — using cached tags from site-data.json"
            : `GitHub tags ${res.status} — using cached tags from site-data.json`;
      const payload = await buildTagsPayload(env, cached, "cache", warning, siteData);
      const response = jsonResponse(payload, 200);
      return logAuthenticatedRequest(context, auth, response, startedAt);
    }
  } catch {
    /* fall through */
  }

  const response = jsonResponse({ error: `Failed to fetch tags from GitHub (${res.status})` }, 502);
  return logAuthenticatedRequest(context, auth, response, startedAt);
}
