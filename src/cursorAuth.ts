import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";

const REACTIVE_KEY =
  "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser";

/** Maximum time (ms) a DB operation is allowed before we consider it hung. */
const DB_OPERATION_TIMEOUT_MS = 15_000;

/** Stale backups older than this (ms) are cleaned up automatically. */
const STALE_BACKUP_AGE_MS = 60 * 60 * 1000; // 1 hour

type SqliteModule = typeof import("node:sqlite");

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

function loadSqlite(): SqliteModule {
  try {
    return require("node:sqlite") as SqliteModule;
  } catch {
    throw new Error(
      `This Cursor build does not provide node:sqlite. ` +
      `Extension host Node version: ${process.versions.node}`
    );
  }
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

    if (stats.size < 100) {
      return { valid: false, reason: "Database file is too small to be valid" };
    }

    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(dbPath, "r");
    try {
      fs.readSync(fd, buffer, 0, 16, 0);
      const header = buffer.toString("utf8", 0, 16);
      if (header !== "SQLite format 3\0") {
        return { valid: false, reason: "Invalid SQLite file header" };
      }
    } finally {
      fs.closeSync(fd);
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

function createBackup(dbPath: string): string | null {
  try {
    const backupPath = `${dbPath}.backup-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
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
  if (!backupPath) {
    return;
  }
  try {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
  } catch {
    // Non-critical
  }
}

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
    // Non-critical
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms: ${label}`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function readCursorKeyDirect(key: string): string | null {
  const dbPath = getCursorGlobalStoragePath();

  if (!fs.existsSync(dbPath)) {
    return null;
  }

  const integrityCheck = validateDatabaseIntegrity(dbPath);
  if (!integrityCheck.valid) {
    throw new Error(
      `Cursor storage database looks damaged (${integrityCheck.reason}). ` +
      "Quit Cursor, remove state.vscdb-wal and state.vscdb-shm, then restart Cursor before using this extension."
    );
  }

  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(dbPath, {
    readOnly: true,
    timeout: 5000,
  });

  try {
    const row = db
      .prepare("SELECT value FROM ItemTable WHERE key = ?")
      .get(key) as { value?: unknown } | undefined;

    return typeof row?.value === "string" ? row.value : null;
  } finally {
    db.close();
  }
}

export async function readCursorAccessToken(): Promise<string | null> {
  return readCursorKeyDirect("cursorAuth/accessToken");
}

const TARGET_COMPOSER = {
  modelName: "composer-2.5",
  maxMode: false,
  selectedModels: [
    {
      modelId: "composer-2.5",
      parameters: [{ id: "fast", value: "false" }],
    },
  ],
};

const FALLBACK_SURFACES = [
  "composer",
  "quick-agent",
  "plan-execution",
  "background-composer",
  "composer-ensemble",
];

function applyFallbackWithSqlite(
  dbPath: string
): { success: boolean; error?: string; alreadySet?: boolean } {
  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(dbPath, { timeout: 5000 });

  try {
    const row = db
      .prepare("SELECT value FROM ItemTable WHERE key = ?")
      .get(REACTIVE_KEY) as { value?: unknown } | undefined;

    if (!row || typeof row.value !== "string") {
      return { success: false, error: "Reactive storage key not found in database" };
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(row.value) as Record<string, unknown>;
    } catch {
      return { success: false, error: "Failed to parse reactive storage JSON" };
    }

    const aiSettings = (data.aiSettings ?? {}) as Record<string, unknown>;
    const modelConfig = (aiSettings.modelConfig ?? {}) as Record<string, unknown>;

    let changed = false;
    for (const surface of FALLBACK_SURFACES) {
      if (JSON.stringify(modelConfig[surface]) !== JSON.stringify(TARGET_COMPOSER)) {
        modelConfig[surface] = TARGET_COMPOSER;
        changed = true;
      }
    }

    if (!changed) {
      return { success: true, alreadySet: true };
    }

    aiSettings.modelConfig = modelConfig;
    data.aiSettings = aiSettings;

    db.exec("BEGIN IMMEDIATE");
    try {
      db
        .prepare("UPDATE ItemTable SET value = ? WHERE key = ?")
        .run(JSON.stringify(data), REACTIVE_KEY);
      db.exec("COMMIT");
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // Ignore rollback failures
      }
      throw error;
    }

    return { success: true };
  } finally {
    db.close();
  }
}

export async function applyComposerFallbackModel(): Promise<{
  success: boolean;
  error?: string;
  alreadySet?: boolean;
}> {
  const dbPath = getCursorGlobalStoragePath();
  if (!fs.existsSync(dbPath)) {
    return { success: false, error: "Database file does not exist" };
  }

  cleanupStaleBackups(dbPath);

  const integrityCheck = validateDatabaseIntegrity(dbPath);
  if (!integrityCheck.valid) {
    return {
      success: false,
      error: `Database integrity check failed: ${integrityCheck.reason}`,
    };
  }

  const backupPath = createBackup(dbPath);
  if (!backupPath) {
    return { success: false, error: "Failed to create database backup" };
  }

  const attemptModification = async (): Promise<{
    success: boolean;
    error?: string;
    alreadySet?: boolean;
  }> => applyFallbackWithSqlite(dbPath);

  try {
    let attemptResult = await withTimeout(
      attemptModification(),
      DB_OPERATION_TIMEOUT_MS,
      "applyComposerFallbackModel"
    );

    if (attemptResult.success) {
      cleanupBackup(backupPath);
      return attemptResult;
    }

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

    restoreFromBackup(backupPath, dbPath);
    cleanupBackup(backupPath);
    return {
      success: false,
      error: attemptResult.error || "Failed to apply fallback model after retry",
    };
  } catch (error) {
    restoreFromBackup(backupPath, dbPath);
    cleanupBackup(backupPath);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during fallback model application",
    };
  }
}

export async function readCachedAccountEmail(): Promise<string | null> {
  return readCursorKeyDirect("cursorAuth/cachedEmail");
}
