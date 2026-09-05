#!/usr/bin/env node
/**
 * Production auth + RBAC smoke (SET-10).
 *
 * Tier A — unauthenticated (public invite gate, firebase-config, 401 on protected routes)
 * Tier B — optional authenticated checks when ADMIN_ID_TOKEN is set (from browser after password login)
 *
 * Usage:
 *   node website/admin/scripts/probe-auth-production.mjs
 *   ADMIN_URL=https://cursor-dev.lorapok.tech node website/admin/scripts/probe-auth-production.mjs
 *   ADMIN_PROBE_EMAIL=you@lorapok.tech node website/admin/scripts/probe-auth-production.mjs
 *   ADMIN_ID_TOKEN=<firebase-id-token> node website/admin/scripts/probe-auth-production.mjs
 */
import { runAuthProductionProbe } from "./lib/auth-production-probe.mjs";

const result = await runAuthProductionProbe({
  adminUrl: process.env.ADMIN_URL,
  idToken: process.env.ADMIN_ID_TOKEN,
  invitedEmail: process.env.ADMIN_PROBE_EMAIL,
});

console.log(`Auth production probe → ${result.adminUrl}\n`);

for (const check of result.checks) {
  const icon = check.skipped ? "○" : check.ok ? "✓" : "✗";
  const suffix = check.skipped ? " (skipped)" : "";
  console.log(`${icon} ${check.name}: ${check.detail}${suffix}`);
}

console.log(
  `\n${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped`
);

if (!result.ok) {
  console.error("\nProbe finished with failures.");
  process.exit(1);
}

console.log("\nProbe OK.");
if (!process.env.ADMIN_ID_TOKEN) {
  console.log(
    "Tip: sign in in production, copy Firebase ID token from devtools, then re-run with ADMIN_ID_TOKEN=… for Tier B. Or run npm run auth:tier-d for full SET-10 headless smoke."
  );
}
