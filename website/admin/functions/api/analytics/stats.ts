import { verifyAdminRequest, jsonResponse } from "../_shared/auth.js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const visitorStatsPath = join(root, "website/visitor-stats.json");

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  if (!existsSync(visitorStatsPath)) {
    return jsonResponse({
      websiteVisits: 0,
      packageClicks: { ovsx: 0, vscode: 0, github: 0, vsix: 0, openvsxDuplicate: 0 },
      totalEngagement: 0,
      updatedAt: null,
    });
  }

  try {
    const stats = JSON.parse(readFileSync(visitorStatsPath, "utf8"));
    return jsonResponse(stats);
  } catch {
    return jsonResponse({ error: "Failed to read visitor stats" }, 500);
  }
}
