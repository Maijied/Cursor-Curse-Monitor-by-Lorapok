import { jsonResponse, verifyAdminRequest, requirePermission } from "./_shared/auth.js";
import { logAuthenticatedRequest, readApiActivity } from "./_shared/activity-log.js";
import { listMailboxMessages } from "./_shared/mailbox.js";
import { readSystemLogs } from "./_shared/system-log.js";
import { applyUnifiedLogFilters, unifiedLogsToCsv } from "./_shared/logs-query.js";

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

export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "logs.read");
  if (denied) return denied;

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
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

  const filtered = applyUnifiedLogFilters(merged, url.searchParams);
  const total = filtered.length;
  const counts = {
    api: apiRows.length,
    mail: mailRows.length,
    system: systemRows.length,
  };

  if (format === "csv") {
    const csv = unifiedLogsToCsv(filtered);
    const response = new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mission-control-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  const response = jsonResponse({
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    counts,
  });

  return logAuthenticatedRequest(context, auth, response, startedAt);
}
