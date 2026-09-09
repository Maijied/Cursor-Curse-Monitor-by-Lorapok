import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { jsonConfigSaveResponse } from "../../_shared/kv-api-response.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  SEO_PROVIDERS,
  mergeSeoHubUpdate,
  mergeSeoProviderUpdate,
  readSeoConfig,
  sanitizeSeoConfigForClient,
  writeSeoConfig,
} from "../../_shared/seo-config.js";

/**
 * Retrieves SEO integration settings (SEO-02).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "integrations.read");
  if (readDenied) return readDenied;

  const config = await readSeoConfig(env);
  return jsonResponse({ ok: true, config: sanitizeSeoConfigForClient(config) });
}

/**
 * Updates one provider block or hub settings under integrations:seo.
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "integrations.write");
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const current = await readSeoConfig(env);
  let next;

  const section = String(body.section ?? "").trim();
  if (section === "hub") {
    try {
      next = mergeSeoHubUpdate(current, body);
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : "Invalid configuration" }, 400);
    }
  } else {
    const provider = String(body.provider ?? "").trim();
    if (!SEO_PROVIDERS.includes(provider)) {
      return jsonResponse(
        {
          error:
            "provider is required (googleSearchConsole, bingWebmaster, azureWebmaster, cloudflareAnalytics, pageSpeedInsights) or section=hub",
        },
        400
      );
    }
    try {
      next = mergeSeoProviderUpdate(current, provider, body);
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : "Invalid configuration" }, 400);
    }
  }

  next.updatedAt = new Date().toISOString();
  next.updatedBy = auth.email;

  try {
    await writeSeoConfig(env, next);
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503);
  }

  return jsonConfigSaveResponse(env, { ok: true, config: sanitizeSeoConfigForClient(next) });
}
