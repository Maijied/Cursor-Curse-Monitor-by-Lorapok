import { jsonResponse, verifyAdminRequest, requirePermission } from "../_shared/auth.js";
import { logAuthenticatedRequest } from "../_shared/activity-log.js";
import { aclAuditRowsToCsv, queryAclAuditEvents } from "../_shared/acl-audit.js";

export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "logs.read");
  if (denied) return denied;

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    500,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25)
  );
  const format = String(url.searchParams.get("format") ?? "").trim().toLowerCase();

  const result = await queryAclAuditEvents(env, {
    page,
    limit,
    exportAll: format === "csv",
    event: url.searchParams.get("event") ?? undefined,
    actor: url.searchParams.get("actor") ?? undefined,
    target: url.searchParams.get("target") ?? undefined,
    since: url.searchParams.get("since") ?? undefined,
    until: url.searchParams.get("until") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });

  if (format === "csv") {
    const csv = aclAuditRowsToCsv(result.items);
    const response = new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="acl-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  const response = jsonResponse(result);
  return logAuthenticatedRequest(context, auth, response, startedAt);
}
