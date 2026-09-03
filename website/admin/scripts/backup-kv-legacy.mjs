#!/usr/bin/env node
/**
 * Create backup points for large legacy KV blobs without deleting live data.
 *
 * Usage (from repo root):
 *   node website/admin/scripts/backup-kv-legacy.mjs
 *
 * Requires wrangler OAuth or CLOUDFLARE_API_TOKEN with KV read/write on ADMIN_KV.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureKvBackupPoint,
  listKvBackupPoints,
} from "../functions/api/_shared/kv-backup.js";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const LEGACY_KEYS = ["api:activity", "system:logs", "mailbox:messages"];

async function loadKvNamespace() {
  const result = spawnSync(
    "npx",
    ["wrangler", "kv", "key", "get", "--binding=ADMIN_KV", "--preview=false", "health:ping"],
    { cwd: adminDir, encoding: "utf8", env: process.env }
  );
  if (result.status !== 0 && !/not found|404/i.test(`${result.stdout}\n${result.stderr}`)) {
    console.warn("wrangler KV probe:", (result.stderr || result.stdout).trim());
  }

  return {
    async get(key) {
      const out = spawnSync(
        "npx",
        ["wrangler", "kv", "key", "get", "--binding=ADMIN_KV", "--preview=false", key],
        { cwd: adminDir, encoding: "utf8", env: process.env }
      );
      if (out.status !== 0) return null;
      return out.stdout;
    },
    async put(key, value) {
      const put = spawnSync(
        "npx",
        ["wrangler", "kv", "key", "put", "--binding=ADMIN_KV", "--preview=false", key, value],
        { cwd: adminDir, encoding: "utf8", env: process.env }
      );
      if (put.status !== 0) {
        throw new Error((put.stderr || put.stdout || "kv put failed").trim());
      }
    },
    async list({ prefix = "", limit = 100 } = {}) {
      const out = spawnSync(
        "npx",
        [
          "wrangler",
          "kv",
          "key",
          "list",
          "--binding=ADMIN_KV",
          "--preview=false",
          "--prefix",
          prefix,
          "--limit",
          String(limit),
        ],
        { cwd: adminDir, encoding: "utf8", env: process.env }
      );
      if (out.status !== 0) {
        throw new Error((out.stderr || out.stdout || "kv list failed").trim());
      }
      const names = out.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      return { keys: names.map((name) => ({ name })) };
    },
  };
}

async function main() {
  const kv = await loadKvNamespace();
  console.log("Creating KV backup points (live keys are preserved)…\n");

  for (const sourceKey of LEGACY_KEYS) {
    const result = await ensureKvBackupPoint(kv, sourceKey, {
      reason: "manual-legacy-backup",
      triggeredBy: "backup-kv-legacy.mjs",
    });
    if (result.backedUp) {
      console.log(`✓ ${sourceKey} → ${result.backupKey} (${result.byteLength} bytes)`);
    } else if (result.reason === "missing") {
      console.log(`· ${sourceKey} (not present)`);
    } else if (result.reason === "unchanged") {
      console.log(`· ${sourceKey} (already backed up at ${result.backupKey})`);
    } else {
      console.log(`✗ ${sourceKey} (${result.reason})`);
    }
  }

  console.log("\nRecent backup points:");
  for (const sourceKey of LEGACY_KEYS) {
    const points = await listKvBackupPoints(kv, sourceKey);
    const latest = points[0];
    if (latest) {
      console.log(`  ${sourceKey}: ${latest.backupKey} @ ${latest.backedUpAt}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
