const ACTIVITY_KEY = "api:activity";
const MAX_ENTRIES = 500;

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} env
 * @param {{ ts?: string; method: string; path: string; status: number; latencyMs: number; email?: string | null }} entry
 */
export async function logApiActivity(env, entry) {
  if (!env?.ADMIN_KV?.get || !env?.ADMIN_KV?.put) return;

  try {
    const raw = await env.ADMIN_KV.get(ACTIVITY_KEY);
    let list = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    }

    list.unshift({
      ts: entry.ts ?? new Date().toISOString(),
      method: entry.method,
      path: entry.path,
      status: entry.status,
      latencyMs: entry.latencyMs,
      email: entry.email ?? null,
    });

    if (list.length > MAX_ENTRIES) {
      list = list.slice(0, MAX_ENTRIES);
    }

    await env.ADMIN_KV.put(ACTIVITY_KEY, JSON.stringify(list));
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
  try {
    await logApiActivity(env, {
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      email: auth.email ?? null,
    });
  } catch {
    /* best effort */
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
