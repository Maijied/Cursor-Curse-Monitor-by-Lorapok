#!/usr/bin/env node
/**
 * Sync FIREBASE_SERVICE_ACCOUNT_JSON from cred vault (or env) → Cloudflare Pages secret.
 * Optional: deploy Firestore rules from website/admin/firestore.rules.
 *
 * Usage:
 *   node website/admin/scripts/sync-firebase-service-account-pages-secret.mjs
 *   node website/admin/scripts/sync-firebase-service-account-pages-secret.mjs --deploy-rules
 *
 * Vault keys (cursor namespace): firebase_service_account_json, FIREBASE_SERVICE_ACCOUNT_JSON
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadFirebaseServiceAccountFromVault,
} from "./lib/cred-vault-sync.mjs";
import { resolveLocalMailEnvAsync } from "./lib/resolve-local-mail-env.mjs";
import { pickDeployAuth, wranglerDeployEnv } from "./lib/mail-credentials.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const project = "cursor-monitor-admin";
const deployRules = process.argv.includes("--deploy-rules");

function resolveServiceAccountJson() {
  const fromEnv = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "").trim();
  if (fromEnv) {
    try {
      const parsed = JSON.parse(fromEnv);
      if (parsed?.client_email && parsed?.private_key) {
        return JSON.stringify(parsed);
      }
    } catch {
      /* fall through */
    }
  }
  return loadFirebaseServiceAccountFromVault();
}

function putPagesSecret(name, value, wranglerEnv) {
  const result = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "put", name, "--project-name", project],
    {
      cwd: adminDir,
      input: value,
      encoding: "utf8",
      env: wranglerEnv,
    }
  );
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`pages secret put ${name} failed${detail ? `: ${detail}` : ""}`);
  }
}

function deployFirestoreRules(serviceAccountJson) {
  const parsed = JSON.parse(serviceAccountJson);
  const projectId =
    String(parsed.project_id ?? process.env.FIREBASE_PROJECT_ID ?? "cursor-curse-by-lorapok").trim();
  const dir = mkdtempSync(join(tmpdir(), "firebase-sa-"));
  const keyPath = join(dir, "service-account.json");
  writeFileSync(keyPath, serviceAccountJson, { mode: 0o600 });
  const env = {
    ...process.env,
    GOOGLE_APPLICATION_CREDENTIALS: keyPath,
  };
  try {
    const result = spawnSync(
      "npx",
      ["-y", "firebase-tools@latest", "deploy", "--only", "firestore:rules", "--project", projectId],
      { cwd: adminDir, env, encoding: "utf8" }
    );
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || "").trim();
      throw new Error(`firebase deploy firestore:rules failed${detail ? `: ${detail.slice(-400)}` : ""}`);
    }
    console.log(`Firestore rules deployed (project: ${projectId})`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const serviceAccountJson = resolveServiceAccountJson();
if (!serviceAccountJson) {
  console.error(
    "FIREBASE_SERVICE_ACCOUNT_JSON missing. Add cursor.firebase_service_account_json to cred vault or export env, then re-run."
  );
  process.exit(1);
}

const parsed = JSON.parse(serviceAccountJson);
console.log(
  JSON.stringify({
    serviceAccountEmail: parsed.client_email,
    projectId: parsed.project_id ?? null,
    source: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? "env" : "vault",
  })
);

const mailEnv = await resolveLocalMailEnvAsync(process.env, adminDir);
const { auth, probe } = await pickDeployAuth(mailEnv);
if (!probe?.ok) {
  console.error("No valid Cloudflare deploy credentials. Run: cd website/admin && npx wrangler login");
  process.exit(1);
}

const wranglerEnv = wranglerDeployEnv(accountId, auth, mailEnv);
putPagesSecret("FIREBASE_SERVICE_ACCOUNT_JSON", serviceAccountJson, wranglerEnv);
console.log("Pages secret FIREBASE_SERVICE_ACCOUNT_JSON synced");

if (deployRules) {
  deployFirestoreRules(serviceAccountJson);
}
