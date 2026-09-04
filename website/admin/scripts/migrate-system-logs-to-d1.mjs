#!/usr/bin/env node
/**
 * One-time migration: KV system logs (scatter + legacy blob) → ADMIN_D1.system_logs.
 *
 * Usage (from repo root):
 *   node website/admin/scripts/migrate-system-logs-to-d1.mjs
 *   node website/admin/scripts/migrate-system-logs-to-d1.mjs --dry-run
 *   node website/admin/scripts/migrate-system-logs-to-d1.mjs --limit 200
 *
 * Requires wrangler OAuth or CLOUDFLARE_API_TOKEN with KV read + D1 write.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mergeSystemLogEntries,
  normalizeSystemLogEntry,
  systemLogInsertSql,
} from "../functions/api/_shared/d1-system-log.js";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const D1_NAME = "ccm-admin-d1";
const LEGACY_KEY = "system:logs";
const SCATTER_PREFIX = "system:log";
const BATCH_SIZE = 80;

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function loadKvNamespace() {
  return {
    async get(key) {
      const out = spawnSync(
        "npx",
        ["wrangler", "kv", "key", "get", "--binding=ADMIN_KV", "--preview=false", key],
        { cwd: adminDir, encoding: "utf8", env: process.env }
      );
      if (out.status !== 0) return null;
      const value = out.stdout;
      if (!value || /^value not found/i.test(value.trim())) return null;
      return value;
    },
    async list({ prefix = "" } = {}) {
      const out = spawnSync(
        "npx",
        ["wrangler", "kv", "key", "list", "--binding=ADMIN_KV", "--preview=false", "--prefix", prefix],
        { cwd: adminDir, encoding: "utf8", env: process.env }
      );
      if (out.status !== 0) {
        throw new Error((out.stderr || out.stdout || "kv list failed").trim());
      }
      const parsed = JSON.parse(out.stdout || "[]");
      const keys = Array.isArray(parsed)
        ? parsed.map((item) =>
            typeof item === "string" ? { name: item } : { name: String(item?.name ?? "") }
          ).filter((item) => item.name)
        : [];
      return { keys, list_complete: true };
    },
  };
}

async function listAllScatterRecords(kv) {
  const listed = await kv.list({ prefix: `${SCATTER_PREFIX}:` });
  const rows = [];
  for (const { name } of listed.keys) {
    const raw = await kv.get(name);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") rows.push(parsed);
    } catch {
      /* skip corrupt row */
    }
  }
  return rows;
}

async function collectKvSystemLogs(kv) {
  const scatter = await listAllScatterRecords(kv);
  let legacy = [];
  try {
    const raw = await kv.get(LEGACY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) legacy = parsed;
    }
  } catch (err) {
    console.warn("Legacy system:logs parse failed:", err instanceof Error ? err.message : err);
  }
  return mergeSystemLogEntries(
    scatter.map((row) => normalizeSystemLogEntry(row)),
    legacy.map((row) => normalizeSystemLogEntry(row))
  );
}

function executeD1Sql(sql, remote = true) {
  const tmpDir = mkdtempSync(join(tmpdir(), "ccm-d1-migrate-"));
  const tmpFile = join(tmpDir, "batch.sql");
  writeFileSync(tmpFile, sql);
  const args = ["wrangler", "d1", "execute", D1_NAME, "--file", tmpFile];
  if (remote) args.push("--remote");
  const result = spawnSync("npx", args, { cwd: adminDir, encoding: "utf8", env: process.env });
  rmSync(tmpDir, { recursive: true, force: true });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "d1 execute failed").trim());
  }
  return result.stdout.trim();
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const limit = Math.max(1, Number.parseInt(argValue("--limit") ?? "5000", 10) || 5000);

  const kv = await loadKvNamespace();
  console.log("Collecting KV system logs (scatter + legacy)…");
  const entries = (await collectKvSystemLogs(kv)).slice(0, limit);
  console.log(`Found ${entries.length} unique log row(s) to migrate.`);

  if (!entries.length) {
    console.log("Nothing to migrate.");
    return;
  }

  if (dryRun) {
    console.log("Dry run — sample ids:", entries.slice(0, 5).map((row) => row.id).join(", "));
    return;
  }

  let migrated = 0;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const sql = `${batch.map((row) => systemLogInsertSql(row)).join("\n")}\n`;
    executeD1Sql(sql, true);
    migrated += batch.length;
    console.log(`Migrated ${migrated}/${entries.length}`);
  }

  console.log(`Done. ${migrated} row(s) inserted into ${D1_NAME}.system_logs (INSERT OR IGNORE).`);
  console.log("New events will write to D1 automatically when ADMIN_D1 is bound in production.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
