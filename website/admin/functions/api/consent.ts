import { jsonResponse } from "./_shared/auth.js";
import {
  normalizeConsentChoice,
  PROCESS_CONSENT_VERSION,
  recordConsentChoice,
} from "./_shared/consent-audit.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Public process-consent audit beacon (aggregate counts only — LEGAL-01).
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, CORS_HEADERS);
  }

  const choice = normalizeConsentChoice(body.choice ?? body.decision ?? body.consent);
  if (!choice) {
    return jsonResponse(
      { error: "choice must be analytics_accept or analytics_decline" },
      400,
      CORS_HEADERS
    );
  }

  try {
    const result = await recordConsentChoice(env, choice);
    if (!result.ok && result.error === "KV put() limit") {
      return jsonResponse(
        {
          error: "Service temporarily unavailable",
          detail: result.error,
          version: PROCESS_CONSENT_VERSION,
        },
        503,
        CORS_HEADERS
      );
    }
    if (!result.ok) {
      return jsonResponse(
        { error: result.error || "Consent audit unavailable", version: PROCESS_CONSENT_VERSION },
        503,
        CORS_HEADERS
      );
    }
    return jsonResponse(
      {
        ok: true,
        choice,
        version: PROCESS_CONSENT_VERSION,
        totals: result.audit.totals,
        updatedAt: result.audit.updatedAt,
      },
      200,
      CORS_HEADERS
    );
  } catch (error) {
    console.error("consent POST", error);
    return jsonResponse({ error: "Failed to record consent" }, 500, CORS_HEADERS);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
