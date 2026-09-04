import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  readCursorIndexConfig,
  sanitizeCursorIndexConfigForClient,
  validateCursorIndexPatch,
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
  const readDenied = requirePermission(auth, "settings.read");
  if (readDenied) return readDenied;

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
  const denied = requirePermission(auth, "settings.write");
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, CORS_HEADERS);
  }

  const validationErrors = validateCursorIndexPatch(body);
  if (validationErrors.length) {
    return jsonResponse({ error: validationErrors[0] }, 400, CORS_HEADERS);
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
