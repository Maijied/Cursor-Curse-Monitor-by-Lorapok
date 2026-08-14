import { jsonResponse } from "../_shared/auth.js";

/** Marketing site analytics use Firestore directly; this beacon is a no-op on Cloudflare Pages. */
export async function onRequestPost(context) {
  const { request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const channel = typeof body.channel === "string" ? body.channel : "website";

  return jsonResponse(
    {
      ok: true,
      channel,
      message: "Analytics persisted via Firestore on the marketing site.",
    },
    200,
    { "Access-Control-Allow-Origin": "*" }
  );
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
