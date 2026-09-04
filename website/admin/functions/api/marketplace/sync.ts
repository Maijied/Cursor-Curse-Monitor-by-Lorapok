import { verifyAdminRequest, jsonResponse, requirePermission } from "../_shared/auth.js";
import { fetchSiteData, packageVersionFromSiteData } from "../_shared/site-data.js";
import { fetchLiveChannels } from "../_shared/live-channels.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "integrations.read");
  if (readDenied) return readDenied;

  let siteData;
  try {
    siteData = await fetchSiteData(env);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "site-data unavailable" }, 502);
  }

  const target = packageVersionFromSiteData(siteData);
  const channels = await fetchLiveChannels(siteData, { githubToken: env.GITHUB_TOKEN });
  const allSynced = channels
    .filter((c) => c.id !== "package" && !c.warn)
    .every((c) => c.version === target);

  return jsonResponse({
    packageVersion: target,
    syncStatus: allSynced ? "synced" : "drift",
    channels: channels.map((c) => ({
      ...c,
      synced: c.version === target,
    })),
    checkedAt: new Date().toISOString(),
  });
}
