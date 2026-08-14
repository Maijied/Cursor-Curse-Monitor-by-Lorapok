import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GITHUB_REPO, jsonResponse, verifyAdminRequest } from "../_shared/auth.js";
import { githubFetch } from "../_shared/github.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function readCachedTags() {
  const siteDataPath = join(root, "website/site-data.json");
  if (!existsSync(siteDataPath)) return [];
  try {
    const data = JSON.parse(readFileSync(siteDataPath, "utf8"));
    if (Array.isArray(data.github?.tags) && data.github.tags.length > 0) {
      return data.github.tags;
    }
    if (data.github?.releaseTag) return [data.github.releaseTag];
    if (data.packageVersion) return [`v${String(data.packageVersion).replace(/^v/, "")}`];
  } catch {
    /* ignore */
  }
  return [];
}

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

  const cached = readCachedTags();
  if (cached.length > 0) {
    const warning =
      res.status === 403
        ? "GitHub API rate limit — using cached tags from site-data.json"
        : `GitHub tags ${res.status} — using cached tags from site-data.json`;
    return jsonResponse({ tags: cached, source: "cache", warning }, 200);
  }

  return jsonResponse({ error: `Failed to fetch tags from GitHub (${res.status})` }, 502);
}
