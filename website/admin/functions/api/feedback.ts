import { jsonResponse } from "./_shared/auth.js";
import { submitProductFeedback } from "./_shared/feedback-submit.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return jsonResponse({ error: "Invalid JSON" }, 400, CORS_HEADERS);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400, CORS_HEADERS);
    }

    if (body.probe === true) {
      return jsonResponse({ ok: true, probed: true, message: "Probe OK" }, 200, CORS_HEADERS);
    }

    const result = await submitProductFeedback(env, {
      kind: typeof body.kind === "string" ? body.kind : undefined,
      message: typeof body.message === "string" ? body.message : String(body.message ?? ""),
      source: typeof body.source === "string" ? body.source : undefined,
      version: typeof body.version === "string" ? body.version : undefined,
      editor: typeof body.editor === "string" ? body.editor : undefined,
      installId:
        typeof body.installId === "string"
          ? body.installId
          : typeof body.install_id === "string"
            ? body.install_id
            : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
    });

    if (!result.ok) {
      return jsonResponse({ error: result.error ?? "Feedback failed" }, result.status ?? 400, CORS_HEADERS);
    }

    return jsonResponse(result, 200, CORS_HEADERS);
  } catch (error) {
    console.error("feedback handler error", error);
    if (String(error instanceof Error ? error.message : error).includes("KV put() limit")) {
      return jsonResponse(
        {
          error: "Service temporarily unavailable",
          detail: error instanceof Error ? error.message : "KV write limit exceeded",
          retryAfter: "KV daily write limit reached — retry tomorrow or upgrade Cloudflare Workers plan.",
        },
        503,
        CORS_HEADERS
      );
    }
    return jsonResponse(
      { error: "Feedback failed", detail: error instanceof Error ? error.message : "Unknown error" },
      500,
      CORS_HEADERS
    );
  }
}
