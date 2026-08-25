#!/usr/bin/env node
/**
 * Diagnose Cloudflare Email Sending for Mission Control.
 *
 *   export CLOUDFLARE_API_TOKEN=...   # needs Account → Email Sending → Edit
 *   export CLOUDFLARE_ACCOUNT_ID=f049faaf2f67549f5c58837479596a4a
 *   node scripts/verify-mail-setup.mjs
 */
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const token = (process.env.CLOUDFLARE_EMAIL_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN ?? "").trim();
const fromAddress = process.env.CCM_MAIL_PROBE_FROM ?? "cursor.monitor@lorapok.tech";
const probeTo = process.env.CCM_MAIL_PROBE_TO ?? "lorapokdev@gmail.com";

if (!token) {
  console.error("Set CLOUDFLARE_API_TOKEN (or CLOUDFLARE_EMAIL_API_TOKEN) with Email Sending → Edit.");
  process.exit(1);
}

async function cf(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
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
  // Account-owned API tokens do not validate on /user/tokens/verify.
  const userVerify = await cf("/user/tokens/verify");
  if (!userVerify.res.ok || userVerify.body.success === false) {
    fail(`Token verify failed (${verify.res.status})`);
    console.error(JSON.stringify(verify.body.errors ?? userVerify.body.errors ?? verify.body, null, 2));
    process.exit(1);
  }
  ok(`Token valid (${userVerify.body.result?.status ?? "active"})`);
} else {
  ok(`Account token valid (${verify.body.result?.status ?? "active"})`);
}

const domains = await cf(`/accounts/${accountId}/email/sending/domains`);
if (domains.res.status === 401 || domains.res.status === 403) {
  fail(`Email Sending API unauthorized (${domains.res.status})`);
  console.error(
    "Create an API token with Account → Email Sending → Edit (not just Workers/Pages deploy)."
  );
  console.error("Then: gh secret set CLOUDFLARE_EMAIL_API_TOKEN");
  console.error("And:  node scripts/enable-mail.mjs");
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
      fail("Send probe blocked: Email Sending disabled on account");
      console.error(
        "Enable Workers Paid, then Cloudflare → Email Service → Email Sending → onboard lorapok.tech"
      );
    } else {
      fail(`Send probe unauthorized (${probe.res.status})`);
    }
} else if (!probe.res.ok || probe.body.success === false) {
  const err = probe.body.errors?.map((e) => e.message).join("; ") || JSON.stringify(probe.body).slice(0, 200);
  fail(`Send probe failed (${probe.res.status}): ${err}`);
} else {
  ok(`Send probe accepted for ${fromAddress} → ${probeTo}`);
}

console.log("\nPages runtime:");
console.log("  • Pages Functions use REST: Pages secret CLOUDFLARE_EMAIL_API_TOKEN");
console.log("  • Prefer an account-owned API token with Email Sending → Edit");
console.log("  • send_email binding is Workers-only (not supported on Pages)");
console.log("\nAfter fixing token/domain, redeploy admin (CI or wrangler pages deploy).");

if (process.exitCode) process.exit(process.exitCode);
