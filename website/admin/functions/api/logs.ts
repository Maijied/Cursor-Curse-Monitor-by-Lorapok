import { jsonResponse, verifyAdminRequest } from "./_shared/auth.js";
import { logAuthenticatedRequest, readApiActivity } from "./_shared/activity-log.js";
import { listMailboxMessages } from "./_shared/mailbox.js";
import { readSystemLogs } from "./_shared/system-log.js";

function normalizeApiRow(row) {
  return {
    id: `api-${row.ts}-${row.path}-${row.method}`,
    type: "api",
    ts: row.ts,
    level: row.status >= 500 ? "error" : row.status >= 400 ? "warn" : "info",
    source: "api",
    method: row.method,
    path: row.path,
    status: row.status,
    latencyMs: row.latencyMs,
    email: row.email ?? null,
    message: `${row.method} ${row.path} → ${row.status} (${row.latencyMs}ms)`,
  };
}

function normalizeMailRow(row) {
  return {
    id: `mail-${row.id}`,
    type: "mail",
    ts: row.ts,
    level: row.status === "failed" ? "error" : "info",
    source: "mailbox",
    direction: row.direction,
    category: row.category,
    status: row.status,
    from: row.from,
    to: row.to,
    subject: row.subject,
    email: row.sentBy ?? row.to,
    message: `${row.direction} ${row.category}: ${row.subject}`,
    read: row.read,
    error: row.error,
  };
}

function normalizeSystemRow(row) {
  return {
    id: `sys-${row.id}`,
    type: "system",
    ts: row.ts,
    level: row.level ?? "info",
    source: row.source,
    email: row.email ?? null,
    message: row.message,
    meta: row.meta ?? {},
  };
}

function applyFilters(items, params) {
  let filtered = items;

  const type = params.get("type");
  if (type && type !== "all") filtered = filtered.filter((r) => r.type === type);

  const level = params.get("level");
  if (level) filtered = filtered.filter((r) => r.level === level);

  const method = params.get("method")?.toUpperCase();
  if (method) filtered = filtered.filter((r) => String(r.method ?? "").toUpperCase() === method);

  const status = params.get("status");
  if (status === "2xx") filtered = filtered.filter((r) => r.status >= 200 && r.status < 300);
  else if (status === "4xx") filtered = filtered.filter((r) => r.status >= 400 && r.status < 500);
  else if (status === "5xx") filtered = filtered.filter((r) => r.status >= 500);
  else if (status === "failed") filtered = filtered.filter((r) => r.status === "failed");

  const source = params.get("source");
  if (source) filtered = filtered.filter((r) => r.source === source);

  const email = params.get("email")?.trim().toLowerCase();
  if (email) {
    filtered = filtered.filter((r) => String(r.email ?? "").toLowerCase().includes(email));
  }

  const q = params.get("q")?.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(
      (r) =>
        String(r.message ?? "").toLowerCase().includes(q) ||
        String(r.path ?? "").toLowerCase().includes(q) ||
        String(r.subject ?? "").toLowerCase().includes(q) ||
        String(r.to ?? "").toLowerCase().includes(q) ||
        String(r.from ?? "").toLowerCase().includes(q) ||
        String(r.method ?? "").toLowerCase().includes(q)
    );
  }

  return filtered;
}

export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25));

  const [apiRows, mailRows, systemRows] = await Promise.all([
    readApiActivity(env),
    listMailboxMessages(env, {}),
    readSystemLogs(env),
  ]);

  const merged = [
    ...apiRows.map(normalizeApiRow),
    ...mailRows.map(normalizeMailRow),
    ...systemRows.map(normalizeSystemRow),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  const filtered = applyFilters(merged, url.searchParams);
  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  const response = jsonResponse({
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    counts: {
      api: apiRows.length,
      mail: mailRows.length,
      system: systemRows.length,
    },
  });

  return logAuthenticatedRequest(context, auth, response, startedAt);
}
