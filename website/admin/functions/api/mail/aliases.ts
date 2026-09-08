import { jsonResponse, requireMasterAdmin, verifyAdminRequest } from "../_shared/auth.js";
import {
  createMailAlias,
  deleteMailAlias,
  getMailAlias,
  listMailAliases,
  updateMailAlias,
} from "../_shared/mail-aliases.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requireMasterAdmin(auth);
  if (denied) return denied.error;

  const url = new URL(request.url);
  const localPart = String(url.searchParams.get("localPart") ?? "").trim().toLowerCase();
  if (localPart) {
    const alias = await getMailAlias(env, localPart);
    if (!alias) return jsonResponse({ error: "Alias not found" }, 404);
    return jsonResponse({ ok: true, alias });
  }

  const aliases = await listMailAliases(env);
  return jsonResponse({ ok: true, aliases });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requireMasterAdmin(auth);
  if (denied) return denied.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  try {
    const result = await createMailAlias(env, body, auth.email);
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Create failed" }, 400);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requireMasterAdmin(auth);
  if (denied) return denied.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const localPart = String(body?.localPart ?? "").trim().toLowerCase();
  if (!localPart) return jsonResponse({ error: "localPart is required" }, 400);

  try {
    const result = await updateMailAlias(env, localPart, body, auth.email);
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    const status = err instanceof Error && err.message === "Alias not found" ? 404 : 400;
    return jsonResponse({ error: err instanceof Error ? err.message : "Update failed" }, status);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requireMasterAdmin(auth);
  if (denied) return denied.error;

  const url = new URL(request.url);
  const localPart = String(url.searchParams.get("localPart") ?? "").trim().toLowerCase();
  if (!localPart) return jsonResponse({ error: "localPart query parameter is required" }, 400);

  try {
    const result = await deleteMailAlias(env, localPart, auth.email);
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    const status = message === "Alias not found" ? 404 : 400;
    return jsonResponse({ error: message }, status);
  }
}
