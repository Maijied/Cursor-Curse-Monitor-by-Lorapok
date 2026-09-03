import { buildBadgeResponse, resolveBadgeKind } from "../_shared/badge-endpoint.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const kind = resolveBadgeKind(url.searchParams.get("kind"));
  return buildBadgeResponse(context.env, kind);
}
