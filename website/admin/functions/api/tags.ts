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
 * Parse GitHub Link header for pagination.
 * @param {string | null} linkHeader
 * @returns {string | null} next URL or null
 */
function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  // Fetch all pages of tags
  let allTags = [];
  let nextUrl = `/repos/${GITHUB_REPO}/tags?per_page=100`;
  let firstRes = null;

  while (nextUrl) {
    const res = await githubFetch(nextUrl, env);
    if (!firstRes) firstRes = res;

    if (!res.ok) break;

    const data = await res.json();
    if (Array.isArray(data)) {
      allTags = allTags.concat(data.map((t) => t.name).filter(Boolean));
    }

    // Parse Link header for next page
    const linkHeader = res.headers.get("Link");
    nextUrl = parseNextLink(linkHeader);
  }

  if (firstRes && firstRes.ok && allTags.length > 0) {
    const payload = await buildTagsPayload(env, allTags, "github");
    const response = jsonResponse(payload, 200);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  const res = firstRes ?? await githubFetch(`/repos/${GITHUB_REPO}/tags?per_page=100`, env);

  try {
    const siteData = await fetchSiteData(env);
    const cached = tagsFromSiteData(siteData);
    if (cached.length > 0) {
      const warning =
        res.status === 403
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
