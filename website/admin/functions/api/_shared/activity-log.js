import {
  API_ACTIVITY_TTL_SECONDS,
  MAX_API_ACTIVITY_ENTRIES,
} from "./kv-limits.js";
import { listScatterRecords, putScatterRecord } from "./kv-scatter.js";

const ACTIVITY_PREFIX = "api:activity";
const LEGACY_ACTIVITY_KEY = "api:activity";

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 */
async function dropLegacyActivityAggregate(kv) {
  if (!kv?.get || !kv?.delete) return;
  try {
    const raw = await kv.get(LEGACY_ACTIVITY_KEY);
    if (raw) await kv.delete(LEGACY_ACTIVITY_KEY);
  } catch (err) {
    console.error("dropLegacyActivityAggregate failed", err);
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ limit?: number }} [options]
 */
export async function readApiActivity(env, options = {}) {
  const kv = env?.ADMIN_KV;
  if (!kv?.get) return [];

  const limit = Math.max(1, Math.min(options.limit ?? MAX_API_ACTIVITY_ENTRIES, MAX_API_ACTIVITY_ENTRIES));

  let scatter = [];
  try {
    scatter = await listScatterRecords(kv, ACTIVITY_PREFIX, { limit });
  } catch (err) {
    console.error("readApiActivity scatter list failed", err);
  }

  let legacy = [];
  try {
    const raw = await kv.get(LEGACY_ACTIVITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) legacy = parsed;
      void dropLegacyActivityAggregate(kv);
    }
  } catch (err) {
    console.error("readApiActivity legacy read failed", err);
  }

  if (!scatter.length) return legacy.slice(0, limit);
  if (!legacy.length) return scatter.slice(0, limit);

  return [...scatter, ...legacy]
    .sort((a, b) => {
      const tb = Date.parse(String(b.ts ?? "")) || 0;
      const ta = Date.parse(String(a.ts ?? "")) || 0;
      if (tb !== ta) return tb - ta;
      return String(b.id ?? "").localeCompare(String(a.id ?? ""));
    })
    .slice(0, limit);
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} env
 * @param {{ ts?: string; method: string; path: string; status: number; latencyMs: number; email?: string | null }} entry
 */
export async function logApiActivity(env, entry) {
  const kv = env?.ADMIN_KV;
  if (!kv?.put) return;

  try {
    const id = crypto.randomUUID();
    await putScatterRecord(
      kv,
      ACTIVITY_PREFIX,
      id,
      {
        id,
        ts: entry.ts ?? new Date().toISOString(),
        method: entry.method,
        path: entry.path,
        status: entry.status,
        latencyMs: entry.latencyMs,
        email: entry.email ?? null,
      },
      { expirationTtl: API_ACTIVITY_TTL_SECONDS }
    );
  } catch (err) {
    console.error("logApiActivity failed", err);
  }
}

/**
 * Log an authenticated admin API request after the handler returns.
 * @param {import("@cloudflare/workers-types").ExecutionContext & { request: Request; env: Record<string, unknown> }} context
 * @param {{ email?: string } | { error: Response }} auth
 * @param {Response} response
 * @param {number} startedAt
 */
export async function logAuthenticatedRequest(context, auth, response, startedAt) {
  if (auth.error) return response;

  const { request, env } = context;
  const logPromise = logApiActivity(env, {
    method: request.method,
    path: new URL(request.url).pathname,
    status: response.status,
    latencyMs: Date.now() - startedAt,
    email: auth.email ?? null,
  });
  if (context.waitUntil) {
    context.waitUntil(logPromise);
  } else {
    try {
      await logPromise;
    } catch {
      /* best effort */
    }
  }
  return response;
}

/**
 * Wrap an authenticated Pages handler with activity logging.
 * @param {(context: unknown, auth: { email: string }) => Promise<Response>} handler
 */
export function withActivityLog(handler) {
  return async (context) => {
    const startedAt = Date.now();
    const auth = await import("./auth.js").then((m) => m.verifyAdminRequest(context.request, context.env));
    if (auth.error) return auth.error;

    const response = await handler(context, auth);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  };
}
