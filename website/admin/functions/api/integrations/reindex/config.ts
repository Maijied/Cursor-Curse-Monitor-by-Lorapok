import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  readReindexConfig,
  sanitizeReindexConfigForClient,
  writeReindexConfig,
} from "../../_shared/reindex-config.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const config = await readReindexConfig(env);
  return jsonResponse(
    { ok: true, config: sanitizeReindexConfigForClient(config) },
    200,
    CORS_HEADERS
  );
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  if (!auth.isMaster) {
    return jsonResponse({ error: "Master admin only" }, 403, CORS_HEADERS);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, CORS_HEADERS);
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Request body must be a JSON object" }, 400, CORS_HEADERS);
  }

  if (
    body.reindexWritePolicy !== undefined &&
    body.reindexWritePolicy !== "live" &&
    body.reindexWritePolicy !== "quit-first"
  ) {
    return jsonResponse(
      { error: "reindexWritePolicy must be live or quit-first" },
      400,
      CORS_HEADERS
    );
  }

  try {
    const config = await writeReindexConfig(env, {
      reindexEnabled:
        typeof body.reindexEnabled === "boolean" ? body.reindexEnabled : undefined,
      reindexWritePolicy:
        body.reindexWritePolicy === "live" || body.reindexWritePolicy === "quit-first"
          ? body.reindexWritePolicy
          : undefined,
      updatedBy: auth.email,
    });
    return jsonResponse(
      { ok: true, config: sanitizeReindexConfigForClient(config) },
      200,
      CORS_HEADERS
    );
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503, CORS_HEADERS);
  }
}
