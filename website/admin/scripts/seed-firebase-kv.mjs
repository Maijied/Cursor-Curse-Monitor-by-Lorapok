#!/usr/bin/env node
/**
 * Seed integrations:firebase in ADMIN_KV from env or CLI args (one-time migration).
 *
 * Usage:
 *   node scripts/seed-firebase-kv.mjs
 *   node scripts/seed-firebase-kv.mjs --from-github-env
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const KV_ID = "8a29ab111ed0488297e12725072e9a10";
const CONFIG_KEY = "integrations:firebase";

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function fromEnv() {
  const apiKey = process.env.VITE_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY ?? arg("--api-key");
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? arg("--project-id");
  if (!apiKey || !projectId) return null;
  return {
    apiKey: String(apiKey).trim(),
    authDomain: String(process.env.VITE_FIREBASE_AUTH_DOMAIN ?? process.env.FIREBASE_AUTH_DOMAIN ?? "").trim(),
    projectId: String(projectId).trim(),
    storageBucket: String(process.env.VITE_FIREBASE_STORAGE_BUCKET ?? process.env.FIREBASE_STORAGE_BUCKET ?? "").trim(),
    messagingSenderId: String(
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? process.env.FIREBASE_MESSAGING_SENDER_ID ?? ""
    ).trim(),
    appId: String(process.env.VITE_FIREBASE_APP_ID ?? process.env.FIREBASE_APP_ID ?? "").trim(),
    measurementId: String(process.env.VITE_FIREBASE_MEASUREMENT_ID ?? process.env.FIREBASE_MEASUREMENT_ID ?? "").trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: "seed-firebase-kv.mjs",
    githubSecretsSyncedAt: new Date().toISOString(),
  };
}

const config = fromEnv();
if (!config?.apiKey || !config.projectId) {
  console.error("Set VITE_FIREBASE_* env vars or pass --api-key and --project-id");
  process.exit(1);
}

const payload = JSON.stringify(config);
const tmpDir = mkdtempSync(join(tmpdir(), "firebase-kv-"));
const tmpFile = join(tmpDir, "firebase.json");
writeFileSync(tmpFile, payload);
const r = spawnSync(
  "npx",
  ["wrangler", "kv", "key", "put", CONFIG_KEY, "--namespace-id", KV_ID, "--path", tmpFile],
  {
    cwd: resolve(rootDir, ".."),
    encoding: "utf8",
  }
);
rmSync(tmpDir, { recursive: true, force: true });

if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(r.status ?? 1);
}

console.log(`KV ${CONFIG_KEY} seeded for project ${config.projectId}`);
