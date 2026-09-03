import { buildBadgeResponse } from "../../_shared/badge-endpoint.js";

/** Shields.io badge JSON at a bot-safe `.svg` path (Open VSX combined total). */
export async function onRequestGet(context) {
  return buildBadgeResponse(context.env, "openvsx-total");
}
