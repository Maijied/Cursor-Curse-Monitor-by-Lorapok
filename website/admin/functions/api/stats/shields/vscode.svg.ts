import { buildBadgeResponse } from "../../_shared/badge-endpoint.js";

/** Shields.io badge JSON at a bot-safe `.svg` path (VS Code Marketplace). */
export async function onRequestGet(context) {
  return buildBadgeResponse(context.env, "vscode");
}
