#!/usr/bin/env node
/**
 * Verify Cloudflare Email Routing rules exist for each Mission Control identity.
 *
 *   cd website/admin && npx wrangler login   # or export CLOUDFLARE_API_TOKEN
 *   node scripts/verify-inbound-routing.mjs
 *   node scripts/verify-inbound-routing.mjs --fix   # provision/update missing rules
 *
 * Manual E2E: send from Gmail to admin@lorapok.tech → should arrive at the identity forwardTo (ops inbox from KV or MAIL_REDIRECT_TO).
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditInboundRouting } from "../functions/api/_shared/cloudflare-email-routing.js";
import { readEmailIdentitiesConfig } from "../functions/api/_shared/email-identities-config.js";
import { syncEmailIdentities } from "../functions/api/_shared/email-identities-sync.js";
import { tryWranglerOAuthToken } from "./lib/mail-credentials.mjs";
import { resolveLocalMailEnvAsync } from "./lib/resolve-local-mail-env.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fix = process.argv.includes("--fix");

let env = await resolveLocalMailEnvAsync(process.env, adminDir);
const config = await readEmailIdentitiesConfig(env);

console.log(`Auditing inbound routing for ${config.domain} (${config.identities.length} identities)…\n`);

async function runAudit(currentEnv) {
  return auditInboundRouting(currentEnv, config);
}

let audit;
try {
  audit = await runAudit(env);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (/authentication|401|403/i.test(message)) {
    const oauth = tryWranglerOAuthToken(adminDir);
    if (oauth) {
      console.log("Retrying audit with wrangler OAuth token…");
      env = { ...env, CLOUDFLARE_API_TOKEN: oauth, CLOUDFLARE_ROUTING_API_TOKEN: oauth };
      audit = await runAudit(env);
    } else {
      console.error(`Audit failed: ${message}`);
      process.exit(1);
    }
  } else {
    console.error(`Audit failed: ${message}`);
    process.exit(1);
  }
}

if (audit.simulated) {
  console.warn(audit.message);
  process.exit(1);
}

for (const row of audit.results) {
  const mark = row.ok ? "✓" : "✗";
  const detail =
    row.routingStatus === "mismatch"
      ? `expected ${row.expectedForward}, got ${row.actualForward ?? "none"}`
      : row.routingStatus === "missing"
        ? "no Cloudflare rule"
        : `→ ${row.expectedForward}`;
  console.log(`${mark} ${row.email} (${row.routingStatus}) ${detail}`);
}

console.log(
  `\nSummary: ${audit.summary.provisioned}/${audit.summary.total} ready, ` +
    `${audit.summary.missing} missing, ${audit.summary.mismatch} mismatch. ` +
    `Cloudflare rules on zone: ${audit.ruleCount}.`
);
console.log(audit.mxNote);

if (!audit.ok && fix) {
  console.log("\nRunning syncEmailIdentities (--fix)…");
  const sync = await syncEmailIdentities(env, {
    persist: Boolean(env.ADMIN_KV?.put),
    updatedBy: "verify-inbound-routing.mjs",
    config,
  });
  for (const row of sync.results) {
    const mark = row.ok ? "✓" : "✗";
    console.log(`${mark} ${row.email}: ${row.message}`);
  }
  const recheck = await auditInboundRouting(env, sync.config ?? config);
  if (recheck.ok) {
    console.log("\nInbound routing OK after fix.");
    process.exit(0);
  }
  console.error("\nSome identities still not ready after sync.");
  process.exit(1);
}

process.exit(audit.ok ? 0 : 1);
