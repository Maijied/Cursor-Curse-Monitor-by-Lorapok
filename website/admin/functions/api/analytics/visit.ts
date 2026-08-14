import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { jsonResponse } from "../_shared/auth.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const visitorStatsPath = join(root, "website/visitor-stats.json");

const DEFAULT_STATS = {
  websiteVisits: 0,
  packageClicks: { ovsx: 0, vscode: 0, github: 0, vsix: 0, openvsxDuplicate: 0 },
  totalEngagement: 0,
  updatedAt: null,
};

function readStats() {
  if (!existsSync(visitorStatsPath)) {
    return { ...DEFAULT_STATS, packageClicks: { ...DEFAULT_STATS.packageClicks } };
  }
  try {
    return JSON.parse(readFileSync(visitorStatsPath, "utf8"));
  } catch {
    return { ...DEFAULT_STATS, packageClicks: { ...DEFAULT_STATS.packageClicks } };
  }
}

function writeStats(stats) {
  writeFileSync(visitorStatsPath, JSON.stringify(stats, null, 2) + "\n");
}

function incrementStats(channel) {
  const stats = readStats();
  if (!stats.packageClicks) stats.packageClicks = { ...DEFAULT_STATS.packageClicks };

  if (channel === "website") {
    stats.websiteVisits = (stats.websiteVisits ?? 0) + 1;
  } else if (channel in stats.packageClicks) {
    stats.packageClicks[channel] = (stats.packageClicks[channel] ?? 0) + 1;
  }

  stats.totalEngagement =
    (stats.websiteVisits ?? 0) +
    Object.values(stats.packageClicks).reduce((s, n) => s + (n ?? 0), 0);
  stats.updatedAt = new Date().toISOString();
  writeStats(stats);
  return stats;
}

const ALLOWED_CHANNELS = new Set(["website", "ovsx", "vscode", "github", "vsix", "openvsxDuplicate"]);

export async function onRequestPost(context) {
  const { request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const channel = typeof body.channel === "string" ? body.channel : "website";
  if (!ALLOWED_CHANNELS.has(channel)) {
    return jsonResponse({ error: "Invalid channel" }, 400);
  }

  const stats = incrementStats(channel);

  return jsonResponse({ ok: true, stats }, 200, {
    "Access-Control-Allow-Origin": "*",
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
