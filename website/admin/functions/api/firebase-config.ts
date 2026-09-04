import { jsonResponse } from "../_shared/auth.js";
import { readFirebaseConfig, toPublicFirebaseClientConfig } from "../_shared/firebase-config.js";

/**
 * Public Firebase web client config (no secrets — keys are browser-exposed by design).
 */
export async function onRequestGet(context) {
  const { env } = context;
  const config = await readFirebaseConfig(env);
  const client = toPublicFirebaseClientConfig(config);
  if (!client) {
    return jsonResponse({ ok: false, error: "Firebase is not configured" }, 503);
  }
  return jsonResponse({ ok: true, config: client });
}
