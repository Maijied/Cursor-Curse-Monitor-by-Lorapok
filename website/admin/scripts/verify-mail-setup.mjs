#!/usr/bin/env node
/**
 * Diagnose Cloudflare Email Sending for Mission Control.
 *
 * Uses CLOUDFLARE_EMAIL_API_TOKEN only (loragent-cloudflare-mail-master).
 * Deploy token is not valid for REST sends.
 *
 *   export CLOUDFLARE_EMAIL_API_TOKEN="$(cred get cursor cloudflare_email_api_token)"
 *   export CLOUDFLARE_ACCOUNT_ID=f049faaf2f67549f5c58837479596a4a
 *   node scripts/verify-mail-setup.mjs
 */
import {
  probeEmailSendingToken,
  requireEmailToken,
} from "./lib/mail-credentials.mjs";

const fromAddress = process.env.CCM_MAIL_PROBE_FROM ?? "cursor.monitor@lorapok.tech";
const probeTo = process.env.CCM_MAIL_PROBE_TO ?? "lorapokdev@gmail.com";

let emailToken;
let accountId;
try {
  ({ emailToken, accountId } = requireEmailToken());
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

if (process.env.CLOUDFLARE_API_TOKEN && !process.env.CLOUDFLARE_EMAIL_API_TOKEN) {
  console.warn(
    "Note: CLOUDFLARE_API_TOKEN is set but CLOUDFLARE_EMAIL_API_TOKEN is not.\n" +
      "Pages REST sends require the dedicated email token — deploy token must not be synced as the Pages secret.\n"
  );
}

async function cf(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${emailToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`✓ ${message}`);
}

console.log("Cloudflare Email setup check\n");

const verify = await cf(`/accounts/${accountId}/tokens/verify`);
if (!verify.res.ok || verify.body.success === false) {
  const userVerify = await cf("/user/tokens/verify");
  if (!userVerify.res.ok || userVerify.body.success === false) {
    fail(`Token verify failed (${verify.res.status})`);
    console.error(JSON.stringify(verify.body.errors ?? userVerify.body.errors ?? verify.body, null, 2));
    process.exit(1);
  }
  ok(`Email token valid (${userVerify.body.result?.status ?? "active"})`);
} else {
  ok(`Account email token valid (${verify.body.result?.status ?? "active"})`);
}

const domains = await probeEmailSendingToken(emailToken, accountId);
if (domains.status === 401 || domains.status === 403) {
  fail(`Email Sending API unauthorized (${domains.status})`);
  console.error("CLOUDFLARE_EMAIL_API_TOKEN needs Account → Email Sending → Edit.");
  console.error("gh secret set CLOUDFLARE_EMAIL_API_TOKEN");
  console.error("node scripts/enable-mail.mjs");
  process.exit(1);
}

const zoneList = domains.body.result ?? [];
const lorapok = zoneList.find((z) => (z.name ?? z.domain) === "lorapok.tech");
if (!lorapok) {
  console.log("ℹ️  Zone Email Sending list unavailable (account tokens may lack zone scope).");
} else {
  ok(`lorapok.tech onboarded (status: ${lorapok.status ?? "active"})`);
}

const probe = await cf(`/accounts/${accountId}/email/sending/send`, {
  method: "POST",
  body: JSON.stringify({
    to: probeTo,
    from: { address: fromAddress, name: "CCM Mail Verify" },
    subject: "CCM mail verify",
    text: `Probe at ${new Date().toISOString()}`,
  }),
});

if (probe.res.status === 401 || probe.res.status === 403) {
  const sendingDisabled = probe.body.errors?.some((e) => e.code === 10203);
  if (sendingDisabled) {
    fail("Send probe blocked: Email Sending disabled on account (10203)");
    console.error("Enable Workers Paid, then Cloudflare → Email Service → Email Sending → onboard lorapok.tech");
  } else {
    fail(`Send probe unauthorized (${probe.res.status})`);
  }
} else if (!probe.res.ok || probe.body.success === false) {
  const err = probe.body.errors?.map((e) => e.message).join("; ") || JSON.stringify(probe.body).slice(0, 200);
  fail(`Send probe failed (${probe.res.status}): ${err}`);
} else {
  ok(`Send probe accepted for ${fromAddress} → ${probeTo}`);
}

console.log("\nPages runtime (loragent-cloudflare-mail-master):");
console.log("  • Pages Functions: REST + CLOUDFLARE_EMAIL_API_TOKEN secret (no send_email on Pages)");
console.log("  • Preferred: MAIL_RELAY → ccm-mail-relay Worker (send_email binding)");
console.log("  • After secret sync: redeploy Pages (repair-mail.mjs or CI admin-deploy)");

if (process.exitCode) process.exit(process.exitCode);
