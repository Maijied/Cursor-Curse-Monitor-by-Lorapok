import { verifyAdminRequest, jsonResponse } from "../_shared/auth.js";
import { fetchSiteData, packageVersionFromSiteData } from "../_shared/site-data.js";
import { fetchGitTagNames, fetchLiveChannels } from "../_shared/live-channels.js";
import { buildRollbackPlan, buildVersionPlan } from "../_shared/version-plan.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const bumpType = url.searchParams.get("bump") ?? "patch";
  const planMode = url.searchParams.get("mode") ?? "release";
  if (!["patch", "minor", "major"].includes(bumpType) && planMode !== "rollback") {
    return jsonResponse({ error: "bump must be patch, minor, or major" }, 400);
  }
  if (!["release", "rollback"].includes(planMode)) {
    return jsonResponse({ error: "mode must be release or rollback" }, 400);
  }

  let siteData;
  try {
    siteData = await fetchSiteData(env);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "site-data unavailable" }, 502);
  }

  const channels = await fetchLiveChannels(siteData, { githubToken: env.GITHUB_TOKEN });
  const existingTags = await fetchGitTagNames({ githubToken: env.GITHUB_TOKEN });
  const latestGitTag = channels.find((c) => c.id === "git-tag")?.version ?? null;

  const targetTag = url.searchParams.get("target_tag") ?? url.searchParams.get("tag");

  const plan =
    planMode === "rollback"
      ? buildRollbackPlan({
          packageVersion: packageVersionFromSiteData(siteData),
          channels,
          existingTags,
          targetTag,
        })
      : buildVersionPlan({
          packageVersion: packageVersionFromSiteData(siteData),
          channels,
          bumpType,
          latestGitTag,
          existingTags,
        });

  return jsonResponse({
    checkedAt: new Date().toISOString(),
    bumpType: planMode === "rollback" ? "rollback" : bumpType,
    planMode,
    channels,
    ...plan,
  });
}
