import { putKvJsonIfChanged } from "./kv-put.js";

const CONFIG_KEY = "integrations:firebase";

/** @typedef {import("./firebase-config-types.js").FirebaseClientConfig} FirebaseClientConfig */

/**
 * @param {Record<string, unknown>} env
 * @returns {FirebaseClientConfig | null}
 */
export function resolveFirebaseConfigFromEnv(env) {
  const apiKey = String(env.VITE_FIREBASE_API_KEY ?? env.FIREBASE_API_KEY ?? "").trim();
  const projectId = String(env.VITE_FIREBASE_PROJECT_ID ?? env.FIREBASE_PROJECT_ID ?? "").trim();
  if (!apiKey || !projectId) return null;

  return {
    apiKey,
    authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN ?? env.FIREBASE_AUTH_DOMAIN ?? "").trim(),
    projectId,
    storageBucket: String(env.VITE_FIREBASE_STORAGE_BUCKET ?? env.FIREBASE_STORAGE_BUCKET ?? "").trim(),
    messagingSenderId: String(
      env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? env.FIREBASE_MESSAGING_SENDER_ID ?? ""
    ).trim(),
    appId: String(env.VITE_FIREBASE_APP_ID ?? env.FIREBASE_APP_ID ?? "").trim(),
    measurementId: String(env.VITE_FIREBASE_MEASUREMENT_ID ?? env.FIREBASE_MEASUREMENT_ID ?? "").trim(),
  };
}

/**
 * @param {Record<string, unknown>} parsed
 * @returns {FirebaseClientConfig & { updatedAt: string | null; updatedBy: string | null }}
 */
export function normalizeFirebaseConfig(parsed) {
  return {
    apiKey: String(parsed.apiKey ?? "").trim(),
    authDomain: String(parsed.authDomain ?? "").trim(),
    projectId: String(parsed.projectId ?? "").trim(),
    storageBucket: String(parsed.storageBucket ?? "").trim(),
    messagingSenderId: String(parsed.messagingSenderId ?? "").trim(),
    appId: String(parsed.appId ?? "").trim(),
    measurementId: String(parsed.measurementId ?? "").trim(),
    updatedAt: parsed.updatedAt ?? null,
    updatedBy: parsed.updatedBy ?? null,
  };
}

/**
 * @param {FirebaseClientConfig} config
 */
export function isCompleteFirebaseConfig(config) {
  return Boolean(
    config?.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.storageBucket &&
      config.messagingSenderId &&
      config.appId
  );
}

/**
 * @param {Record<string, unknown>} env
 */
async function readFirebaseConfigFromKv(env) {
  if (!env?.ADMIN_KV?.get) {
    throw new Error("ADMIN_KV binding not configured");
  }
  const raw = await env.ADMIN_KV.get(CONFIG_KEY);
  if (!raw) return null;
  return normalizeFirebaseConfig(JSON.parse(raw));
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readFirebaseConfig(env) {
  try {
    const fromKv = await readFirebaseConfigFromKv(env);
    if (fromKv && isCompleteFirebaseConfig(fromKv)) return fromKv;
  } catch {
    /* fall through */
  }
  const fromEnv = resolveFirebaseConfigFromEnv(env);
  if (fromEnv && isCompleteFirebaseConfig(fromEnv)) {
    return { ...fromEnv, updatedAt: null, updatedBy: null };
  }
  return null;
}

/**
 * @param {Record<string, unknown>} env
 * @param {FirebaseClientConfig & { updatedAt?: string; updatedBy?: string }} config
 */
export async function writeFirebaseConfig(env, config) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await putKvJsonIfChanged(env.ADMIN_KV, CONFIG_KEY, normalizeFirebaseConfig(config));
}

/**
 * @param {FirebaseClientConfig | null} config
 */
export function toPublicFirebaseClientConfig(config) {
  if (!config || !isCompleteFirebaseConfig(config)) return null;
  const out = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  };
  if (config.measurementId) out.measurementId = config.measurementId;
  return out;
}

/**
 * @param {FirebaseClientConfig | null} config
 */
export function sanitizeFirebaseConfigForClient(config) {
  if (!config) {
    return {
      configured: false,
      apiKeyPreview: null,
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: "",
      measurementId: "",
      updatedAt: null,
      updatedBy: null,
      githubSecretsSyncedAt: null,
    };
  }
  const apiKey = config.apiKey ?? "";
  return {
    configured: isCompleteFirebaseConfig(config),
    apiKeyPreview: apiKey ? `···${apiKey.slice(-4)}` : null,
    authDomain: config.authDomain ?? "",
    projectId: config.projectId ?? "",
    storageBucket: config.storageBucket ?? "",
    messagingSenderId: config.messagingSenderId ?? "",
    appId: config.appId ?? "",
    measurementId: config.measurementId ?? "",
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
    githubSecretsSyncedAt: config.githubSecretsSyncedAt ?? null,
  };
}

/**
 * Maps Firebase client config to GitHub Actions environment secret names.
 * @param {FirebaseClientConfig} config
 */
export function firebaseConfigToGithubSecrets(config) {
  const secrets = {
    VITE_FIREBASE_API_KEY: config.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
    VITE_FIREBASE_PROJECT_ID: config.projectId,
    VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
    VITE_FIREBASE_APP_ID: config.appId,
    FIREBASE_PROJECT_ID: config.projectId,
  };
  if (config.measurementId) {
    secrets.VITE_FIREBASE_MEASUREMENT_ID = config.measurementId;
  }
  return secrets;
}
