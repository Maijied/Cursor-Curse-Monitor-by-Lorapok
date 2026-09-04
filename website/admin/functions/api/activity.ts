import { jsonResponse, verifyAdminRequest, requirePermission } from "./_shared/auth.js";
import { logAuthenticatedRequest, readApiActivity } from "./_shared/activity-log.js";

function applyFilters(items, params) {
  let filtered = items;

  const method = params.get("method")?.toUpperCase();
  if (method) filtered = filtered.filter((r) => String(r.method).toUpperCase() === method);

  const status = params.get("status");
  if (status === "2xx") filtered = filtered.filter((r) => r.status >= 200 && r.status < 300);
  else if (status === "4xx") filtered = filtered.filter((r) => r.status >= 400 && r.status < 500);
  else if (status === "5xx") filtered = filtered.filter((r) => r.status >= 500);

  const path = params.get("path")?.trim();
  if (path) filtered = filtered.filter((r) => String(r.path).includes(path));

  const email = params.get("email")?.trim().toLowerCase();
  if (email) filtered = filtered.filter((r) => String(r.email ?? "").toLowerCase().includes(email));

  const q = params.get("q")?.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(
      (r) =>
        String(r.path).toLowerCase().includes(q) ||
        String(r.method).toLowerCase().includes(q) ||
        String(r.email ?? "").toLowerCase().includes(q) ||
        String(r.status).includes(q)
    );
  }

  return filtered;
}

export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "logs.read");
  if (denied) return denied;

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25));

  const all = applyFilters(await readApiActivity(env), url.searchParams);
  const total = all.length;
  const start = (page - 1) * limit;
  const items = all.slice(start, start + limit).map((row) => ({
    id: row.id ?? `${row.ts}-${row.path}`,
    timestamp: row.ts,
    method: row.method,
    path: row.path,
    status: row.status,
    latencyMs: row.latencyMs,
    email: row.email,
    type: "api",
  }));

  const response = jsonResponse({
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });

  return logAuthenticatedRequest(context, auth, response, startedAt);
}
