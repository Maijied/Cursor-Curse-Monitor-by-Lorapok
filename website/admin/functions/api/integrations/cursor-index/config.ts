import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  readCursorIndexConfig,
  sanitizeCursorIndexConfigForClient,
  writeCursorIndexConfig,
} from "../../_shared/cursor-index-config.js";

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

  const config = await readCursorIndexConfig(env);
  return jsonResponse(
    { ok: true, config: sanitizeCursorIndexConfigForClient(config) },
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

  if (
    body.indexWritePolicy !== undefined &&
    body.indexWritePolicy !== "live" &&
    body.indexWritePolicy !== "quit-first"
  ) {
    return jsonResponse({ error: "indexWritePolicy must be live or quit-first" }, 400, CORS_HEADERS);
  }

  const intFields = ["transcriptLookbackDays", "maxReindexRecords", "maxExportRecords", "maxImportRecords"];
  for (const field of intFields) {
    if (body[field] !== undefined && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) {
      return jsonResponse({ error: `${field} must be a non-negative integer` }, 400, CORS_HEADERS);
    }
  }

  try {
    const config = await writeCursorIndexConfig(env, {
      indexEnabled: typeof body.indexEnabled === "boolean" ? body.indexEnabled : undefined,
      indexWritePolicy:
        body.indexWritePolicy === "live" || body.indexWritePolicy === "quit-first"
          ? body.indexWritePolicy
          : undefined,
      cipExportEnabled: typeof body.cipExportEnabled === "boolean" ? body.cipExportEnabled : undefined,
      cipImportEnabled: typeof body.cipImportEnabled === "boolean" ? body.cipImportEnabled : undefined,
      transcriptLookbackDays:
        body.transcriptLookbackDays !== undefined ? Number(body.transcriptLookbackDays) : undefined,
      maxReindexRecords:
        body.maxReindexRecords !== undefined ? Number(body.maxReindexRecords) : undefined,
      maxExportRecords: body.maxExportRecords !== undefined ? Number(body.maxExportRecords) : undefined,
      maxImportRecords: body.maxImportRecords !== undefined ? Number(body.maxImportRecords) : undefined,
      cipRequireSanitization:
        typeof body.cipRequireSanitization === "boolean" ? body.cipRequireSanitization : undefined,
      cipDedupeAcrossUsers:
        typeof body.cipDedupeAcrossUsers === "boolean" ? body.cipDedupeAcrossUsers : undefined,
      cipAllowCrossUserLocalImport:
        typeof body.cipAllowCrossUserLocalImport === "boolean"
          ? body.cipAllowCrossUserLocalImport
          : undefined,
      updatedBy: auth.email,
    });
    return jsonResponse(
      { ok: true, config: sanitizeCursorIndexConfigForClient(config) },
      200,
      CORS_HEADERS
    );
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503, CORS_HEADERS);
  }
}
