import { jsonResponse } from "../_shared/auth.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

/** Visitor stats are stored in Firestore (stats/visitors). This endpoint is deprecated on Pages. */
export async function onRequestGet() {
  return jsonResponse({
    websiteVisits: 0,
    packageClicks: { ovsx: 0, vscode: 0, github: 0, vsix: 0, openvsxDuplicate: 0 },
    totalEngagement: 0,
    updatedAt: null,
    source: "firestore",
    message: "Live visitor stats are read from Firestore in the admin UI.",
  }, 200, CORS_HEADERS);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
