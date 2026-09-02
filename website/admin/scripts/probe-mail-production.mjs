#!/usr/bin/env node
/**
 * Production mail + Discord readiness probe (no admin auth required).
 *
 * Checks public Mission Control endpoints for outbound mail transport,
 * Lorapok Labs Family invite URL, and optional testmail subscribe delivery.
 *
 * Usage:
 *   ADMIN_URL=https://cursor-dev.lorapok.tech node website/admin/scripts/probe-mail-production.mjs
 *
 * Optional E2E (needs testmail creds):
 *   TESTMAIL_API_KEY=... TESTMAIL_NAMESPACE=... node website/admin/scripts/probe-mail-production.mjs --e2e
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const adminUrl = String(process.env.ADMIN_URL ?? "https://cursor-dev.lorapok.tech").replace(/\/$/, "");
const runE2e = process.argv.includes("--e2e");

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.warn(`⚠ ${message}`);
}

async function fetchJson(path) {
  const res = await fetch(`${adminUrl}${path}`);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(`${path} HTTP ${res.status}: ${data.error ?? text.slice(0, 120)}`);
  }
  return data;
}

async function main() {
  console.log(`Production probe → ${adminUrl}\n`);

  const health = await fetchJson("/api/health");
  if (!health.mailConfigured) {
    fail("Outbound mail transport is not configured");
  } else {
    pass(`Mail transport: ${health.mailTransport}`);
  }

  if (!health.mailResendConfigured && health.mailTransport === "cloudflare-rest") {
    warn("RESEND_API_KEY missing — external Gmail/testmail delivery may fail on Workers Free");
  } else if (health.mailResendConfigured) {
    pass("Resend API key configured");
  }

  if (!health.mailRelayBound && health.mailTransport === "cloudflare-rest") {
    warn("MAIL_RELAY not bound — run Mailbox → Sync up or repair-mail.mjs");
  } else if (health.mailRelayBound) {
    pass("MAIL_RELAY service binding active");
  }

  const site = await fetchJson("/api/site-config");
  if (!site.mailConfigured && site.requireMailForSubscribe) {
    warn("Subscribe modal requires mail but transport reports unavailable");
  } else {
    pass(`Subscribe available: ${site.subscribeAvailable ? "yes" : "no"}`);
  }

  const invite = String(site.discordInviteUrl ?? "").trim();
  if (!invite.startsWith("https://discord.gg/")) {
    fail(`Invalid discordInviteUrl on site-config: ${invite || "(empty)"}`);
  } else {
    pass(`Lorapok Labs Family invite: ${invite}`);
  }

  if (health.communityDiscordConfigured) {
    pass("Community Discord webhook configured");
  } else {
    warn("Community Discord webhook not set — configure Lorapok Labs Family hook in Settings");
  }

  if (runE2e) {
    console.log("\nRunning testmail subscribe E2E…");
    const child = spawnSync(
      "node",
      [resolve(adminDir, "scripts/probe-subscribe-testmail.mjs")],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          SUBSCRIBE_URL: `${adminUrl}/api/subscribe`,
        },
      }
    );
    if (child.status !== 0) {
      fail("Testmail subscribe E2E failed");
    } else {
      pass("Testmail subscribe E2E passed");
    }
  } else {
    console.log("\nSkip live delivery test (pass --e2e with TESTMAIL_* to run subscribe probe)");
  }

  if (process.exitCode) {
    console.error("\nProbe finished with failures.");
  } else {
    console.log("\nProbe finished OK.");
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
