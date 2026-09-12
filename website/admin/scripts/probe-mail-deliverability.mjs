#!/usr/bin/env node
/**
 * Run MAIL-16 deliverability audit against production (static + live testmail probes).
 *
 *   npm run mail:probe-deliverability --prefix website/admin
 */
import { resolveAdminIdToken } from "./lib/admin-api-auth.mjs";

const DEFAULT_URL = process.env.ADMIN_PUBLIC_URL ?? "https://cursor-dev.lorapok.tech";

async function main() {
  const { adminUrl, idToken } = await resolveAdminIdToken({ adminUrl: DEFAULT_URL });
  const res = await fetch(`${adminUrl}/api/integrations/mail/deliverability`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  console.log(JSON.stringify(data, null, 2));
  if (!res.ok || data.ok === false) {
    process.exit(1);
  }
  if (data.status?.allOk !== true) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
