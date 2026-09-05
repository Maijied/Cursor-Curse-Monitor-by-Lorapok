import { logSystemEvent } from "./system-log.js";
import { readSystemLogs } from "./system-log.js";
import { readSystemLogsD1BySource, isAdminD1Available } from "./d1-system-log.js";

export const ACL_AUDIT_SOURCE = "acl";

export const ACL_AUDIT_EVENTS = [
  "allowlist.add",
  "allowlist.remove",
  "role.assign",
  "role.change",
  "role.clear",
];

/**
 * @param {ReturnType<import("./d1-system-log.js").normalizeSystemLogEntry>} row
 */
export function normalizeAclAuditRow(row) {
  const meta = row.meta && typeof row.meta === "object" ? row.meta : {};
  return {
    id: row.id,
    ts: row.ts,
    level: row.level ?? "info",
    event: String(meta.event ?? ""),
    actor: String(row.email ?? meta.actor ?? "").trim().toLowerCase(),
    target: String(meta.target ?? "").trim().toLowerCase(),
    previousRole: meta.previousRole ?? null,
    newRole: meta.newRole ?? null,
    message: row.message,
  };
}

/**
 * @param {Array<ReturnType<typeof normalizeAclAuditRow>>} rows
 * @param {{ event?: string; actor?: string; target?: string; since?: string; until?: string; q?: string }} filters
 */
export function filterAclAuditRows(rows, filters = {}) {
  let out = rows;

  const event = String(filters.event ?? "").trim();
  if (event) out = out.filter((row) => row.event === event);

  const actor = String(filters.actor ?? "").trim().toLowerCase();
  if (actor) out = out.filter((row) => row.actor.includes(actor));

  const target = String(filters.target ?? "").trim().toLowerCase();
  if (target) out = out.filter((row) => row.target.includes(target));

  const since = filters.since ? Date.parse(filters.since) : NaN;
  if (!Number.isNaN(since)) {
    out = out.filter((row) => (Date.parse(row.ts) || 0) >= since);
  }

  const until = filters.until ? Date.parse(filters.until) : NaN;
  if (!Number.isNaN(until)) {
    out = out.filter((row) => (Date.parse(row.ts) || 0) <= until);
  }

  const q = String(filters.q ?? "").trim().toLowerCase();
  if (q) {
    out = out.filter(
      (row) =>
        row.message.toLowerCase().includes(q) ||
        row.actor.includes(q) ||
        row.target.includes(q) ||
        row.event.includes(q)
    );
  }

  return out;
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ page?: number; limit?: number; event?: string; actor?: string; target?: string; since?: string; until?: string; q?: string }} options
 */
export async function queryAclAuditEvents(env, options = {}) {
  const page = Math.max(1, Number(options.page ?? 1) || 1);
  const limit = Math.min(500, Math.max(1, Number(options.limit ?? 25) || 25));
  const exportAll = options.exportAll === true;

  let rows = [];
  if (isAdminD1Available(env)) {
    const d1Rows = await readSystemLogsD1BySource(env, ACL_AUDIT_SOURCE);
    if (d1Rows) rows = d1Rows;
  }
  if (!rows.length) {
    const all = await readSystemLogs(env);
    rows = all.filter((row) => row.source === ACL_AUDIT_SOURCE);
  }

  const normalized = rows.map(normalizeAclAuditRow);
  const filtered = filterAclAuditRows(normalized, options);
  const total = filtered.length;
  const items = exportAll
    ? filtered.slice(0, 500)
    : filtered.slice((page - 1) * limit, (page - 1) * limit + limit);

  const eventCounts = {};
  for (const row of filtered) {
    const key = row.event || "unknown";
    eventCounts[key] = (eventCounts[key] ?? 0) + 1;
  }

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    eventCounts,
  };
}

/**
 * @param {Array<ReturnType<typeof normalizeAclAuditRow>>} rows
 */
export function aclAuditRowsToCsv(rows) {
  const header = ["timestamp", "event", "actor", "target", "previous_role", "new_role", "message"];
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
        row.event,
        row.actor,
        row.target,
        row.previousRole ?? "",
        row.newRole ?? "",
        row.message,
      ]
        .map(escape)
        .join(",")
    ),
  ];
  return lines.join("\n");
}

/**
 * @param {{
 *   action: string;
 *   target: string;
 *   previousRole?: string | null;
 *   newRole?: string | null;
 * }} params
 */
export function formatAclAuditMessage({ action, target, previousRole, newRole }) {
  switch (action) {
    case "allowlist.add":
      return `Added ${target} to admin allowlist (${newRole ?? "admin"})`;
    case "allowlist.remove":
      return `Removed ${target} from admin allowlist`;
    case "role.change":
      return `Changed role for ${target}: ${previousRole ?? "default"} → ${newRole ?? "admin"}`;
    case "role.assign":
      return `Assigned ${newRole ?? "admin"} role to ${target}`;
    case "role.clear":
      return `Cleared explicit role for ${target} (reverts to default admin)`;
    default:
      return `ACL ${action} for ${target}`;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {{
 *   actor: string;
 *   action: string;
 *   target: string;
 *   previousRole?: string | null;
 *   newRole?: string | null;
 *   meta?: Record<string, unknown>;
 * }} entry
 */
export async function logAclAuditEvent(env, entry) {
  const actor = String(entry.actor ?? "").trim().toLowerCase();
  const target = String(entry.target ?? "").trim().toLowerCase();
  if (!actor || !target) return;

  const message = formatAclAuditMessage({
    action: entry.action,
    target,
    previousRole: entry.previousRole,
    newRole: entry.newRole,
  });

  await logSystemEvent(env, {
    level: "info",
    source: ACL_AUDIT_SOURCE,
    message,
    email: actor,
    meta: {
      event: entry.action,
      target,
      previousRole: entry.previousRole ?? null,
      newRole: entry.newRole ?? null,
      ...(entry.meta ?? {}),
    },
  });
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ actor: string; target: string; role: string; previousRole?: string | null }} params
 */
export async function logRoleAssignment(env, params) {
  const role = String(params.role ?? "").trim().toLowerCase();
  const previousRole = params.previousRole ? String(params.previousRole).trim().toLowerCase() : null;
  if (previousRole === role) return;

  const action = previousRole ? "role.change" : "role.assign";
  await logAclAuditEvent(env, {
    actor: params.actor,
    action,
    target: params.target,
    previousRole,
    newRole: role,
  });
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ actor: string; target: string; previousRole?: string | null }} params
 */
export async function logRoleClear(env, params) {
  await logAclAuditEvent(env, {
    actor: params.actor,
    action: "role.clear",
    target: params.target,
    previousRole: params.previousRole ?? null,
    newRole: "admin",
  });
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ actor: string; target: string; role: string }} params
 */
export async function logAllowlistAdd(env, params) {
  await logAclAuditEvent(env, {
    actor: params.actor,
    action: "allowlist.add",
    target: params.target,
    newRole: params.role,
  });
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ actor: string; target: string; previousRole?: string | null }} params
 */
export async function logAllowlistRemove(env, params) {
  await logAclAuditEvent(env, {
    actor: params.actor,
    action: "allowlist.remove",
    target: params.target,
    previousRole: params.previousRole ?? null,
  });
}
