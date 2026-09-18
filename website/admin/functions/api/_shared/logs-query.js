/**
 * LOGS-01 — unified log filter + CSV export helpers (API / mail / system merge).
 */

/**
 * @param {URLSearchParams | Record<string, string | undefined | null>} params
 * @returns {Record<string, string>}
 */
export function normalizeLogFilterParams(params) {
  const get = (key) => {
    if (params instanceof URLSearchParams) return params.get(key) ?? "";
    return String(params?.[key] ?? "");
  };
  return {
    type: get("type"),
    level: get("level"),
    method: get("method"),
    status: get("status"),
    source: get("source"),
    email: get("email"),
    q: get("q"),
    since: get("since"),
    until: get("until"),
  };
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {URLSearchParams | Record<string, string | undefined | null>} params
 */
export function applyUnifiedLogFilters(items, params) {
  const f = normalizeLogFilterParams(params);
  let filtered = items;

  if (f.type && f.type !== "all") filtered = filtered.filter((r) => r.type === f.type);

  if (f.level) filtered = filtered.filter((r) => r.level === f.level);

  const method = f.method.toUpperCase();
  if (method) filtered = filtered.filter((r) => String(r.method ?? "").toUpperCase() === method);

  if (f.status === "2xx") filtered = filtered.filter((r) => Number(r.status) >= 200 && Number(r.status) < 300);
  else if (f.status === "4xx") filtered = filtered.filter((r) => Number(r.status) >= 400 && Number(r.status) < 500);
  else if (f.status === "5xx") filtered = filtered.filter((r) => Number(r.status) >= 500);
  else if (f.status === "failed") filtered = filtered.filter((r) => r.status === "failed");

  if (f.source) filtered = filtered.filter((r) => r.source === f.source);

  const email = f.email.trim().toLowerCase();
  if (email) {
    filtered = filtered.filter((r) => String(r.email ?? "").toLowerCase().includes(email));
  }

  const since = f.since ? Date.parse(f.since) : NaN;
  if (!Number.isNaN(since)) {
    filtered = filtered.filter((r) => (Date.parse(String(r.ts)) || 0) >= since);
  }

  const until = f.until ? Date.parse(f.until) : NaN;
  if (!Number.isNaN(until)) {
    filtered = filtered.filter((r) => (Date.parse(String(r.ts)) || 0) <= until);
  }

  const q = f.q.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((r) => {
      const metaText =
        r.meta && typeof r.meta === "object" ? JSON.stringify(r.meta).toLowerCase() : "";
      return (
        String(r.message ?? "").toLowerCase().includes(q) ||
        String(r.path ?? "").toLowerCase().includes(q) ||
        String(r.subject ?? "").toLowerCase().includes(q) ||
        String(r.to ?? "").toLowerCase().includes(q) ||
        String(r.from ?? "").toLowerCase().includes(q) ||
        String(r.method ?? "").toLowerCase().includes(q) ||
        String(r.source ?? "").toLowerCase().includes(q) ||
        String(r.level ?? "").toLowerCase().includes(q) ||
        metaText.includes(q)
      );
    });
  }

  return filtered;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function unifiedLogsToCsv(rows) {
  const header = [
    "timestamp",
    "type",
    "level",
    "source",
    "method",
    "path",
    "status",
    "email",
    "message",
    "meta",
  ];
  const escape = (value) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.ts,
        row.type,
        row.level,
        row.source,
        row.method ?? "",
        row.path ?? "",
        row.status ?? "",
        row.email ?? "",
        row.message ?? "",
        row.meta && typeof row.meta === "object" ? JSON.stringify(row.meta) : "",
      ]
        .map(escape)
        .join(",")
    ),
  ];
  return lines.join("\n");
}
