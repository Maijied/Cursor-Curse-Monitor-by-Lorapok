#!/usr/bin/env node
/**
 * Remove stale state.vscdb.backup-* files left by older extension builds.
 *
 * Usage:
 *   node scripts/cleanup-cursor-db-backups.mjs
 *   node scripts/cleanup-cursor-db-backups.mjs --product Cursor --dry-run
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const productIdx = args.indexOf("--product");
const product = productIdx >= 0 ? args[productIdx + 1] : "Cursor";

function globalStorageDir(name) {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", name, "User", "globalStorage");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), name, "User", "globalStorage");
  }
  return path.join(home, ".config", name, "User", "globalStorage");
}

function cleanupDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }

  let removed = 0;
  let freedBytes = 0;
  for (const entry of fs.readdirSync(dir)) {
    if (!/\.backup-/.test(entry) && !entry.includes(".tmp-")) {
      continue;
    }
    if (!entry.startsWith("state.vscdb")) {
      continue;
    }
    const fullPath = path.join(dir, entry);
    try {
      const size = fs.statSync(fullPath).size;
      if (!dryRun) {
        fs.unlinkSync(fullPath);
      }
      removed += 1;
      freedBytes += size;
    } catch (error) {
      console.warn(`Skip ${entry}: ${error instanceof Error ? error.message : error}`);
    }
  }

  const mb = (freedBytes / (1024 * 1024)).toFixed(1);
  console.log(
    `${dryRun ? "Would remove" : "Removed"} ${removed} backup file(s) (${mb} MB) from ${dir}`
  );
}

const dir = globalStorageDir(product);
cleanupDirectory(dir);
