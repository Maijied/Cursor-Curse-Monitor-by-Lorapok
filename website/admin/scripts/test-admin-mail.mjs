#!/usr/bin/env node
/**
 * Test Send & Receive Mail Probe for admin@lorapok.tech
 *
 * Opt-in live probe — requires wrangler OAuth and Cloudflare Email Sending.
 *   npm run mail:test --prefix website/admin
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const adminDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";

function wranglerToken() {
  const r = spawnSync("npx", ["wrangler", "auth", "token", "--json"], {
    encoding: "utf8",
    cwd: adminDir,
  });
  if (r.status !== 0) {
    console.error("❌ wrangler auth token failed:", r.stderr);
    process.exit(1);
  }
  const text = `${r.stdout}\n${r.stderr}`;
  const match = text.match(/\{[\s\S]*"token"[\s\S]*\}/);
  if (!match) {
    console.error("❌ No token JSON found");
    process.exit(1);
  }
  return JSON.parse(match[0]).token;
}

async function sendMail(fromAddress, toAddress, subject, bodyText) {
  const token = wranglerToken();
  console.log(`📤 Sending test email from ${fromAddress} to ${toAddress}...`);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: toAddress,
        from: { address: fromAddress, name: "Lorapok Admin Verification" },
        subject: subject,
        text: bodyText,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #6366f1; border-radius: 8px;">
          <h2 style="color: #4f46e5;">Lorapok Labs Email Routing & Sending Verification</h2>
          <p>This is a live diagnostic probe confirming that <strong>${fromAddress}</strong> can dispatch and route emails across Cloudflare Email Services.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;">
          <p><strong>Sender:</strong> ${fromAddress}</p>
          <p><strong>Recipient:</strong> ${toAddress}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p style="color: #16a34a; font-weight: bold;">Status: Verified & Operational ✅</p>
        </div>`
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const timestamp = new Date().toLocaleString();
  
  // Test 1: Send from admin@lorapok.tech to admin@lorapok.tech (loopback through Cloudflare Email Routing)
  console.log("=== Test 1: admin@lorapok.tech -> admin@lorapok.tech ===");
  const test1 = await sendMail(
    "admin@lorapok.tech",
    "admin@lorapok.tech",
    `[Live Test] admin@lorapok.tech Loopback Probe (${timestamp})`,
    `Hello! This is a test email sent from admin@lorapok.tech to admin@lorapok.tech at ${timestamp}. Cloudflare Email Routing forwards this to the ops inbox.`
  );
  console.log("Response Status:", test1.status);
  console.log("Payload:", JSON.stringify(test1.data, null, 2));

  // Test 2: Send from admin@lorapok.tech to ops destination (lorapokdev@gmail.com)
  console.log("\n=== Test 2: admin@lorapok.tech -> lorapokdev@gmail.com ===");
  const test2 = await sendMail(
    "admin@lorapok.tech",
    "lorapokdev@gmail.com",
    `[Live Test] admin@lorapok.tech Direct Ops Probe (${timestamp})`,
    `Direct delivery verification from admin@lorapok.tech to lorapokdev@gmail.com at ${timestamp}.`
  );
  console.log("Response Status:", test2.status);
  console.log("Payload:", JSON.stringify(test2.data, null, 2));
}

main();
