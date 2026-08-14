import { verifyAdminRequest, jsonResponse } from "../_shared/auth.js";

/** Visitor stats are stored in Firestore (stats/visitors). This endpoint is deprecated on Pages. */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  return jsonResponse({
    websiteVisits: 0,
    packageClicks: { ovsx: 0, vscode: 0, github: 0, vsix: 0, openvsxDuplicate: 0 },
    totalEngagement: 0,
    updatedAt: null,
    source: "firestore",
    message: "Live visitor stats are read from Firestore in the admin UI.",
  });
}
