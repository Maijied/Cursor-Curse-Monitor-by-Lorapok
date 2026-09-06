import { getAllowedAdminEmails } from "../_shared/admins.js";
import { jsonResponse } from "../_shared/auth.js";

/**
 * Pre-auth invite gate — returns whether an email is on the admin allowlist.
 * Does not reveal the allowlist; only answers for the supplied email.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = String(url.searchParams.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@") || email.length > 254) {
    return jsonResponse({ error: "Valid email query parameter required" }, 400);
  }

  try {
    const allowed = await getAllowedAdminEmails(env);
    return jsonResponse({ invited: allowed.has(email) });
  } catch (err) {
    console.error("invite-check allowlist read failed", err);
    return jsonResponse({ invited: false, error: "allowlist_unavailable" }, 503);
  }
}
