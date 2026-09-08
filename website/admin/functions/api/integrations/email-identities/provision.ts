import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import { provisionIdentityRouting } from "../../_shared/cloudflare-email-routing.js";
import {
  identityEmail,
  readEmailIdentitiesConfig,
  sanitizeEmailIdentitiesForClient,
  upsertIdentity,
  validateIdentityLocalPart,
  writeEmailIdentitiesConfig,
} from "../../_shared/email-identities-config.js";
import { syncAliasAuthAccess } from "../../_shared/mail-aliases.js";
import { isValidMailAddress } from "../../_shared/mail-config.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "mail.provision");
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const localCheck = validateIdentityLocalPart(body?.localPart);
  if (!localCheck.ok) {
    return jsonResponse({ error: localCheck.error }, 400);
  }

  const localPart = localCheck.value;
  const forwardTo = String(body?.forwardTo ?? "").trim().toLowerCase();
  const displayName = String(body?.displayName ?? localPart).trim().slice(0, 80) || localPart;
  const label = String(body?.label ?? displayName).trim().slice(0, 120) || displayName;
  const project = String(body?.project ?? "").trim().slice(0, 80);
  const coworkerEmail = String(body?.coworkerEmail ?? "").trim().toLowerCase();
  const category = String(body?.category ?? "custom").toLowerCase();
  const authAllowed = body?.authAllowed === true;
  const authRole = String(body?.authRole ?? "viewer").toLowerCase();

  const config = await readEmailIdentitiesConfig(env);
  const resolvedForward = forwardTo || config.opsForwardTo;
  if (!isValidMailAddress(resolvedForward)) {
    return jsonResponse({ error: "Valid forwardTo email is required" }, 400);
  }

  const address = identityEmail(localPart, config.domain);
  const ruleName = localPart.replace(/\./g, "-");

  try {
    const provision = body?.dryRun === true
      ? {
          simulated: true,
          routingStatus: "pending",
          cloudflareRuleId: null,
          message: "Dry run — no Cloudflare API call",
        }
      : await provisionIdentityRouting(env, {
          address,
          forwardTo: resolvedForward,
          ruleName,
        });

    let next = upsertIdentity(config, localPart, {
      displayName,
      label,
      project,
      coworkerEmail,
      category,
      forwardTo: resolvedForward,
      enabled: true,
      authAllowed,
      authRole,
      routingStatus: provision.routingStatus,
      cloudflareRuleId: provision.cloudflareRuleId,
      provisionedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    const identity = next.identities.find((item) => item.localPart === localPart);
    let authSync = null;
    if (authAllowed && identity) {
      authSync = await syncAliasAuthAccess(env, identity, next.domain, { enable: true });
    }

    next = {
      ...next,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.email,
    };
    await writeEmailIdentitiesConfig(env, next);

    return jsonResponse({
      ok: true,
      provision,
      authSync,
      identity: sanitizeEmailIdentitiesForClient(next).identities.find((i) => i.localPart === localPart),
      config: sanitizeEmailIdentitiesForClient(next),
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Provision failed" },
      502
    );
  }
}
