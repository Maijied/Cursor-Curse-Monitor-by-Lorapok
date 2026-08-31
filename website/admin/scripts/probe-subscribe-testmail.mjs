#!/usr/bin/env node
/**
 * E2E: POST /api/subscribe with a testmail.app inbox, then poll the inbox API.
 *
 * Prerequisites:
 *   1. testmail.app account — https://testmail.app/console/
 *   2. Outbound mail must reach external addresses (Resend on Pages OR Workers Paid).
 *      Cloudflare Free sandbox only sends to verified Gmail addresses.
 *
 * Usage:
 *   export TESTMAIL_API_KEY=...
 *   export TESTMAIL_NAMESPACE=61z27
 *   node website/admin/scripts/probe-subscribe-testmail.mjs
 *
 *   SUBSCRIBE_URL=https://cursor-dev.lorapok.tech/api/subscribe node .../probe-subscribe-testmail.mjs
 */
import {
  resolveTestmailConfig,
  testmailAddress,
  waitForTestmailTag,
} from "./lib/testmail.mjs";

const subscribeUrl =
  process.env.SUBSCRIBE_URL?.trim() || "https://cursor-dev.lorapok.tech/api/subscribe";

async function main() {
  const { apiKey, namespace } = resolveTestmailConfig();
  const tag = `ccm-subscribe-${Date.now()}`;
  const email = testmailAddress(namespace, tag);

  console.log(`Subscribe probe → ${subscribeUrl}`);
  console.log(`Test inbox: ${email}`);
  console.log(`Poll tag: ${tag}\n`);

  const res = await fetch(subscribeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      consent: true,
      source: "testmail-probe",
    }),
  });

  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error(`✗ Subscribe HTTP ${res.status} (non-JSON): ${raw.slice(0, 200)}`);
    process.exit(1);
  }

  console.log("Subscribe response:", JSON.stringify(data, null, 2));

  if (!res.ok || data.ok === false) {
    console.error("\n✗ Subscribe failed before mail could be tested.");
    if (data.mailWarning?.includes("verified address")) {
      console.error(
        "  Cloudflare sandbox blocked delivery. Set RESEND_API_KEY:\n" +
          "    node website/admin/scripts/setup-resend-secret.mjs"
      );
    }
    process.exit(1);
  }

  if (!data.emailed) {
    console.warn("⚠ Subscribe OK but emailed=false — welcome mail may not have been sent.");
  }

  console.log("\nPolling testmail.app (livequery, up to 90s)…");
  const emailRow = await waitForTestmailTag({ apiKey, namespace, tag });

  if (!emailRow) {
    console.error("✗ No welcome email in testmail inbox within timeout.");
    console.error("  Check Mission Control mailbox logs or configure Resend for external delivery.");
    process.exit(1);
  }

  console.log("\n✓ Welcome email received in testmail inbox");
  console.log(`  From: ${emailRow.from ?? "(unknown)"}`);
  console.log(`  Subject: ${emailRow.subject ?? "(no subject)"}`);
  const preview = String(emailRow.text ?? emailRow.html ?? "").replace(/\s+/g, " ").slice(0, 160);
  if (preview) console.log(`  Preview: ${preview}…`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
