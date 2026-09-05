#!/usr/bin/env node
/**
 * Sync ADMIN_MASTER_EMAIL to Cloudflare Pages (Functions runtime).
 *
 *   node website/admin/scripts/setup-admin-master-secret.mjs
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  pickDeployAuth,
  putPagesSecret,
  resolveAdminMasterEmailFromEnv,
  resolveMailCredentials,
} from "./lib/mail-credentials.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { accountId } = resolveMailCredentials();

const masterEmail = resolveAdminMasterEmailFromEnv();
if (!masterEmail) {
  console.error(
    "::error::ADMIN_MASTER_EMAIL missing — set cursor admin_master_email in cred vault or export ADMIN_MASTER_EMAIL."
  );
  process.exit(1);
}

const { auth, probe } = await pickDeployAuth(process.env);
if (!probe?.ok || !auth) {
  console.error("::error::No valid Cloudflare deploy credentials. Run: cd website/admin && npx wrangler login");
  process.exit(1);
}

putPagesSecret("ADMIN_MASTER_EMAIL", masterEmail, {
  adminDir,
  accountId,
  auth,
  baseEnv: process.env,
});

console.log("::notice::Pages secret ADMIN_MASTER_EMAIL updated.");
