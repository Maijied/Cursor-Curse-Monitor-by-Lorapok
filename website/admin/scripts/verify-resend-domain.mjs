#!/usr/bin/env node
/**
 * MAIL-07 — verify mail.lorapok.tech in Resend (+ optional Cloudflare DNS audit).
 *
 *   cd website/admin && node scripts/verify-resend-domain.mjs
 *   node scripts/verify-resend-domain.mjs --verify   # trigger Resend POST /domains/:id/verify
 *   node scripts/verify-resend-domain.mjs --sync-kv  # set resendDomainVerified in ADMIN_KV when verified
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { envWithCursorCloudflareSecrets } from "./lib/cred-vault-sync.mjs";
import { cloudflareAuthHeaders, resolveMailCredentials } from "./lib/mail-credentials.mjs";
import {
  DEFAULT_SENDING_DOMAIN,
  runResendDomainVerification,
} from "./lib/resend-domain-verify.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KV_ID = "8a29ab111ed0488297e12725072e9a10";
const MAIL_KEY = "integrations:mail";
const RESEND_KEY = "integrations:resend";

const triggerVerify = process.argv.includes("--verify");
const syncKv = process.argv.includes("--sync-kv");
const domainArg = process.argv.find((a, i) => process.argv[i - 1] === "--domain");
const domain = String(domainArg ?? process.env.RESEND_SENDING_DOMAIN ?? DEFAULT_SENDING_DOMAIN).toLowerCase();

const mailEnv = envWithCursorCloudflareSecrets(process.env);
const apiKey = String(mailEnv.RESEND_API_KEY ?? "").trim();
if (!apiKey) {
  console.error("RESEND_API_KEY missing. Add cursor/resend_api_key to cred vault.");
  process.exit(1);
}

const { deployToken, globalApiKey, globalApiEmail } = resolveMailCredentials();
const zoneId = String(mailEnv.CLOUDFLARE_ZONE_ID ?? "").trim();
const cfHeaders =
  globalApiKey && globalApiEmail
    ? cloudflareAuthHeaders({ globalApiKey, globalApiEmail })
    : deployToken
      ? cloudflareAuthHeaders({ bearerToken: deployToken })
      : undefined;

const result = await runResendDomainVerification({
  apiKey,
  cfHeaders,
  zoneId: zoneId || undefined,
  resolveZone: Boolean(cfHeaders && !zoneId),
  domain,
  verify: triggerVerify,
});

console.log(`Resend domain verification → ${domain}\n`);

for (const check of result.checks) {
  const icon = check.skipped ? "○" : check.ok ? "✓" : "✗";
  console.log(`${icon} ${check.name}: ${check.detail}${check.skipped ? " (skipped)" : ""}`);
}

if (result.summary?.records?.length) {
  console.log("\nResend DNS record status:");
  for (const rec of result.summary.records) {
    const mark = rec.status === "verified" ? "✓" : "✗";
    console.log(`  ${mark} ${rec.record} ${rec.name} (${rec.type}) — ${rec.status}`);
  }
}

if (syncKv && result.summary?.verified) {
  const now = new Date().toISOString();
  const patch = {
    sendingDomain: domain,
    resendDomainVerified: true,
    updatedAt: now,
    updatedBy: "verify-resend-domain.mjs",
  };

  for (const key of [MAIL_KEY, RESEND_KEY]) {
    const get = spawnSync(
      "npx",
      ["wrangler", "kv", "key", "get", key, "--namespace-id", KV_ID],
      { cwd: adminDir, encoding: "utf8" }
    );
    let current = {};
    if (get.status === 0 && get.stdout.trim()) {
      try {
        current = JSON.parse(get.stdout);
      } catch {
        current = {};
      }
    }
    const next = { ...current, ...patch };
    const tmpDir = mkdtempSync(join(tmpdir(), "resend-kv-"));
    const tmpFile = join(tmpDir, "config.json");
    writeFileSync(tmpFile, JSON.stringify(next));
    const put = spawnSync(
      "npx",
      ["wrangler", "kv", "key", "put", key, "--namespace-id", KV_ID, "--path", tmpFile],
      { cwd: adminDir, encoding: "utf8" }
    );
    rmSync(tmpDir, { recursive: true, force: true });
    if (put.status !== 0) {
      console.error(`\n✗ KV sync failed for ${key}`);
      console.error(put.stderr || put.stdout);
      process.exitCode = 1;
    } else {
      console.log(`\n✓ KV ${key} → resendDomainVerified=true, sendingDomain=${domain}`);
    }
  }
} else if (syncKv && !result.summary?.verified) {
  console.error("\n✗ --sync-kv skipped: domain not verified in Resend yet");
  process.exitCode = 1;
}

if (!result.ok) {
  console.error("\nVerification incomplete. See docs/guides/RESEND_WORKERS_FREE_SETUP.md §2.");
  process.exit(1);
}

console.log("\nMAIL-07 OK — Resend sending domain verified.");
