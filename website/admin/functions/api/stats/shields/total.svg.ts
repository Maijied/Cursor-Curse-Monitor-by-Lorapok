import { buildBadgeResponse } from "../../_shared/badge-endpoint.js";

/** Shields.io badge JSON at a bot-safe `.svg` path (total downloads). */
export async function onRequestGet(context) {
  return buildBadgeResponse(context.env, "total");
}
