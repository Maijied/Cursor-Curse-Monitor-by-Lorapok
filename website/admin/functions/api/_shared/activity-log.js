const ACTIVITY_PREFIX = "api:activity:";
const ENTRY_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} env
 * @param {{ ts?: string; method: string; path: string; status: number; latencyMs: number; email?: string | null }} entry
 */
export async function logApiActivity(env, entry) {
  if (!env?.ADMIN_KV?.put) return;

  try {
    const key = `${ACTIVITY_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await env.ADMIN_KV.put(
      key,
      JSON.stringify({
        ts: entry.ts ?? new Date().toISOString(),
        method: entry.method,
        path: entry.path,
        status: entry.status,
        latencyMs: entry.latencyMs,
        email: entry.email ?? null,
      }),
      { expirationTtl: ENTRY_TTL_SECONDS }
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
