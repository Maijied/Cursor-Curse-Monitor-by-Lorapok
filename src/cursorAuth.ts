import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import initSqlJs, { Database } from "sql.js";

const REACTIVE_KEY =
  "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser";

/** Maximum time (ms) a DB operation is allowed before we consider it hung. */
const DB_OPERATION_TIMEOUT_MS = 15_000;

/** Stale backups older than this (ms) are cleaned up automatically. */
const STALE_BACKUP_AGE_MS = 60 * 60 * 1000; // 1 hour

export function getCursorGlobalStoragePath(): string {
  if (process.env.CURSOR_DB_PATH) {
    return process.env.CURSOR_DB_PATH;
  }
  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return path.join(
        home,
        "Library",
        "Application Support",
        "Cursor",
        "User",
        "globalStorage",
        "state.vscdb"
      );
    case "win32":
      return path.join(
        process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
        "Cursor",
        "User",
        "globalStorage",
        "state.vscdb"
      );
    default:
      return path.join(
        home,
        ".config",
        "Cursor",
        "User",
        "globalStorage",
        "state.vscdb"
      );
  }
}

async function openDatabase(dbPath: string, wasmPath: string): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });
  const fileBuffer = fs.readFileSync(dbPath);
  return new SQL.Database(fileBuffer);
}

function validateDatabaseIntegrity(dbPath: string): { valid: boolean; reason?: string } {
  try {
    if (!fs.existsSync(dbPath)) {
      return { valid: false, reason: "Database file does not exist" };
    }

    const stats = fs.statSync(dbPath);

    if (stats.size === 0) {
      return { valid: false, reason: "Database file is empty" };
    }

    // Check if file is suspiciously large (>100MB may indicate corruption)
    if (stats.size > 100 * 1024 * 1024) {
      return { valid: false, reason: "Database file is too large (possible corruption)" };
    }

    // Check if file is too small to be valid SQLite (<100 bytes)
    if (stats.size < 100) {
      return { valid: false, reason: "Database file is too small to be valid" };
    }

    // Basic SQLite header check (first 16 bytes should be "SQLite format 3\0")
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(dbPath, 'r');
    try {
      fs.readSync(fd, buffer, 0, 16, 0);
      const header = buffer.toString('utf8', 0, 16);
      if (header !== 'SQLite format 3\0') {
        return { valid: false, reason: "Invalid SQLite file header" };
      }
    } finally {
      fs.closeSync(fd);
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : "Unknown validation error"
    };
  }
}

function createBackup(dbPath: string): string | null {
  try {
    const backupPath = `${dbPath}.backup-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    fs.copyFileSync(dbPath, backupPath);
    return backupPath;
  } catch {
    return null;
  }
}

function restoreFromBackup(backupPath: string, originalPath: string): boolean {
  try {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, originalPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function cleanupBackup(backupPath: string | null): void {
  if (!backupPath) { return; }
  try {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
  } catch {
    // Silently fail on cleanup — non-critical
  }
}

/**
 * Clean up stale backup files that may have been left by previous crashes.
 */
function cleanupStaleBackups(dbPath: string): void {
  try {
    const dir = path.dirname(dbPath);
    const basename = path.basename(dbPath);
    const entries = fs.readdirSync(dir);
    const now = Date.now();
    for (const entry of entries) {
      if (entry.startsWith(`${basename}.backup-`) || entry.startsWith(`${basename}.tmp-`)) {
        const fullPath = path.join(dir, entry);
        try {
          const stats = fs.statSync(fullPath);
          if (now - stats.mtimeMs > STALE_BACKUP_AGE_MS) {
            fs.unlinkSync(fullPath);
          }
        } catch {
          // Ignore individual cleanup failures
        }
      }
    }
  } catch {
    // Non-critical — don't fail the operation
  }
}

function atomicWrite(dbPath: string, buffer: Buffer): { success: boolean; reason?: string } {
  const tempPath = `${dbPath}.tmp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  try {
    fs.writeFileSync(tempPath, buffer);

    // Verify the temp file was written successfully
    const tempStats = fs.statSync(tempPath);
    if (tempStats.size !== buffer.length) {
      try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
      return { success: false, reason: "Temp file size mismatch" };
    }

    // Atomic replace operation
    try {
      fs.renameSync(tempPath, dbPath);
    } catch {
      // renameSync can fail across filesystem boundaries — fall back to copy+delete
      fs.copyFileSync(tempPath, dbPath);
      try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    }

    // Verify the final file
    const finalStats = fs.statSync(dbPath);
    if (finalStats.size !== buffer.length) {
      return { success: false, reason: "Final file size mismatch after atomic replace" };
    }

    return { success: true };
  } catch (error) {
    // Clean up temp file on failure
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    return {
      success: false,
      reason: error instanceof Error ? error.message : "Unknown write error"
    };
  }
}

/**
 * Wraps an async operation with a timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms: ${label}`));
    }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export async function readCursorAccessToken(
  wasmPath: string
): Promise<string | null> {
  const dbPath = getCursorGlobalStoragePath();
  if (!fs.existsSync(dbPath)) {
    return null;
  }

  const db = await openDatabase(dbPath, wasmPath);
  try {
    const result = db.exec(
      "SELECT value FROM ItemTable WHERE key = ?",
      ['cursorAuth/accessToken']
    );
    if (!result.length || !result[0].values.length) {
      return null;
    }
    const token = result[0].values[0][0];
    return typeof token === "string" ? token : null;
  } finally {
    db.close();
  }
}

export async function applyComposerFallbackModel(
  wasmPath: string
): Promise<{ success: boolean; error?: string; alreadySet?: boolean }> {
  const dbPath = getCursorGlobalStoragePath();
  if (!fs.existsSync(dbPath)) {
    return { success: false, error: "Database file does not exist" };
  }

  // Clean up any stale backups from previous runs
  cleanupStaleBackups(dbPath);

  // Step 1: Validate database integrity before any operations
  const integrityCheck = validateDatabaseIntegrity(dbPath);
  if (!integrityCheck.valid) {
    return { success: false, error: `Database integrity check failed: ${integrityCheck.reason}` };
  }

  const targetComposer = {
    modelName: "composer-2.5",
    maxMode: false,
    selectedModels: [
      {
        modelId: "composer-2.5",
        parameters: [{ id: "fast", value: "false" }],
      },
    ],
  };

  const surfaces = [
    "composer",
    "quick-agent",
    "plan-execution",
    "background-composer",
    "composer-ensemble",
  ];

  // Step 2: Create backup before modifications
  const backupPath = createBackup(dbPath);
  if (!backupPath) {
    return { success: false, error: "Failed to create database backup" };
  }

  const attemptModification = async (): Promise<{ success: boolean; error?: string; alreadySet?: boolean }> => {
    let db: Database | null = null;
    try {
      db = await openDatabase(dbPath, wasmPath);

      const result = db.exec(
        "SELECT value FROM ItemTable WHERE key = ?",
        [REACTIVE_KEY]
      );
      if (!result.length || !result[0].values.length) {
        return { success: false, error: "Reactive storage key not found in database" };
      }

      const raw = result[0].values[0][0];
      if (typeof raw !== "string") {
        return { success: false, error: "Reactive storage value is not a string" };
      }

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return { success: false, error: "Failed to parse reactive storage JSON" };
      }

      const aiSettings = (data.aiSettings ?? {}) as Record<string, unknown>;
      const modelConfig = (aiSettings.modelConfig ?? {}) as Record<string, unknown>;

      let changed = false;
      for (const surface of surfaces) {
        if (JSON.stringify(modelConfig[surface]) !== JSON.stringify(targetComposer)) {
          modelConfig[surface] = targetComposer;
          changed = true;
        }
      }

      if (!changed) {
        return { success: true, alreadySet: true };
      }

      aiSettings.modelConfig = modelConfig;
      data.aiSettings = aiSettings;

      const updated = JSON.stringify(data);
      db.run("UPDATE ItemTable SET value = ? WHERE key = ?", [updated, REACTIVE_KEY]);

      const exported = db.export();

      // Close DB before writing to avoid holding references during file I/O
      db.close();
      db = null;

      // Step 3: Use atomic write instead of direct write
      const writeResult = atomicWrite(dbPath, Buffer.from(exported));
      if (!writeResult.success) {
        return { success: false, error: `Atomic write failed: ${writeResult.reason}` };
      }

      // Step 4: Verify integrity after write
      const postWriteCheck = validateDatabaseIntegrity(dbPath);
      if (!postWriteCheck.valid) {
        return { success: false, error: `Post-write integrity check failed: ${postWriteCheck.reason}` };
      }

      return { success: true };
    } finally {
      if (db) {
        try { db.close(); } catch { /* ignore close errors */ }
      }
    }
  };

  try {
    // First attempt with timeout
    let attemptResult = await withTimeout(
      attemptModification(),
      DB_OPERATION_TIMEOUT_MS,
      "applyComposerFallbackModel"
    );

    if (attemptResult.success) {
      cleanupBackup(backupPath);
      return attemptResult;
    }

    // Retry once: restore from backup then try again
    const restored = restoreFromBackup(backupPath, dbPath);
    if (!restored) {
      cleanupBackup(backupPath);
      return { success: false, error: "Failed to restore backup for retry" };
    }

    attemptResult = await withTimeout(
      attemptModification(),
      DB_OPERATION_TIMEOUT_MS,
      "applyComposerFallbackModel (retry)"
    );

    if (attemptResult.success) {
      cleanupBackup(backupPath);
      return attemptResult;
    }

    // Final failure — restore backup
    restoreFromBackup(backupPath, dbPath);
    cleanupBackup(backupPath);
    return {
      success: false,
      error: attemptResult.error || "Failed to apply fallback model after retry"
    };
  } catch (error) {
    // Restore backup on any unhandled error
    restoreFromBackup(backupPath, dbPath);
    cleanupBackup(backupPath);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during fallback model application"
    };
  }
}

export function readCachedAccountEmail(wasmPath: string): Promise<string | null> {
  return readKeyValue(wasmPath, "cursorAuth/cachedEmail");
}

async function readKeyValue(
  wasmPath: string,
  key: string
): Promise<string | null> {
  const dbPath = getCursorGlobalStoragePath();
  if (!fs.existsSync(dbPath)) {
    return null;
  }

  const db = await openDatabase(dbPath, wasmPath);
  try {
    const result = db.exec(
      "SELECT value FROM ItemTable WHERE key = ?",
      [key]
    );
    if (!result.length || !result[0].values.length) {
      return null;
    }
    const value = result[0].values[0][0];
    return typeof value === "string" ? value : null;
  } finally {
    db.close();
  }
}
