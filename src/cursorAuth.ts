import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import { execSync } from "child_process";

export const REACTIVE_STORAGE_KEY =
  "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser";

const REACTIVE_KEY = REACTIVE_STORAGE_KEY;

/** Maximum time (ms) a DB operation is allowed before we consider it hung. */
const DB_OPERATION_TIMEOUT_MS = 15_000;

/** Stale backups older than this (ms) are cleaned up automatically. */
const STALE_BACKUP_AGE_MS = 60 * 60 * 1000; // 1 hour

type SqliteModule = typeof import("node:sqlite");
type SqliteDb = InstanceType<SqliteModule["DatabaseSync"]>;

export type EditorHost = "cursor" | "vscode" | "unknown";

export function detectEditorHost(appName?: string): EditorHost {
  const name = (appName || process.env.VSCODE_APP_NAME || "").toLowerCase();
  if (name.includes("cursor")) return "cursor";
  if (name.includes("visual studio code") || name.includes("vscode") || name === "code") {
    return "vscode";
  }
  // Default path resolution prefers Cursor when ambiguous.
  return "cursor";
}

function appDataRoot(host: EditorHost): { darwin: string; win32: string; linux: string } {
  const product = host === "vscode" ? "Code" : "Cursor";
  const home = os.homedir();
  return {
    darwin: path.join(home, "Library", "Application Support", product, "User", "globalStorage", "state.vscdb"),
    win32: path.join(
      process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
      product,
      "User",
      "globalStorage",
      "state.vscdb"
    ),
    linux: path.join(home, ".config", product, "User", "globalStorage", "state.vscdb"),
  };
}

/** Resolve Cursor or VS Code globalStorage state.vscdb for the current host. */
export function getCursorGlobalStoragePath(host?: EditorHost): string {
  if (process.env.CURSOR_DB_PATH) {
    return process.env.CURSOR_DB_PATH;
  }
  const resolvedHost = host ?? detectEditorHost();
  const roots = appDataRoot(resolvedHost === "unknown" ? "cursor" : resolvedHost);
  switch (process.platform) {
    case "darwin":
      return roots.darwin;
    case "win32":
      return roots.win32;
    default:
      return roots.linux;
  }
}

/** True when the editor process that owns the DB appears to be running. */
export function isEditorProcessRunning(host: EditorHost = detectEditorHost()): boolean {
  if (process.env.CURSOR_EDITOR_RUNNING === "1") return true;
  if (process.env.CURSOR_EDITOR_RUNNING === "0") return false;

  const patterns =
    host === "vscode"
      ? ["Code.exe", "code", "Code - OSS", "code-oss"]
      : ["Cursor.exe", "Cursor", "cursor"];

  try {
    if (process.platform === "win32") {
      const out = execSync("tasklist", { encoding: "utf8", timeout: 3000 });
      return patterns.some((p) => out.toLowerCase().includes(p.toLowerCase()));
    }
    const out = execSync("ps -A -o comm=", { encoding: "utf8", timeout: 3000 });
    const lines = out.split("\n").map((l) => l.trim());
    return patterns.some((p) =>
      lines.some((line) => line === p || line.endsWith(`/${p}`) || line.toLowerCase() === p.toLowerCase())
    );
  } catch {
    // If process detection fails, refuse writes (fail closed for data safety).
    return true;
  }
}

export function cursorDbExists(host?: EditorHost): boolean {
  return fs.existsSync(getCursorGlobalStoragePath(host));
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

type BackupBundle = {
  stamp: string;
  files: Array<{ original: string; backup: string }>;
};

function companionPaths(dbPath: string): string[] {
  return [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
}

/** Backup state.vscdb + WAL + SHM. Fails closed if the main DB cannot be copied. */
export function createFullBackup(dbPath: string): BackupBundle | null {
  try {
    const stamp = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const files: BackupBundle["files"] = [];
    for (const original of companionPaths(dbPath)) {
      if (!fs.existsSync(original)) continue;
      const backup = `${original}.backup-${stamp}`;
      fs.copyFileSync(original, backup);
      files.push({ original, backup });
    }
    if (!files.some((f) => f.original === dbPath)) {
      return null;
    }
    return { stamp, files };
  } catch {
    return null;
  }
}

function restoreFullBackup(bundle: BackupBundle | null): boolean {
  if (!bundle) return false;
  try {
    for (const { original, backup } of bundle.files) {
      if (fs.existsSync(backup)) {
        fs.copyFileSync(backup, original);
      }
    }
    return true;
  } catch {
    return false;
  }
}

function cleanupFullBackup(bundle: BackupBundle | null): void {
  if (!bundle) return;
  for (const { backup } of bundle.files) {
    try {
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
    } catch {
      // Non-critical
    }
  }
}

function cleanupStaleBackups(dbPath: string): void {
  try {
    const dir = path.dirname(dbPath);
    const basename = path.basename(dbPath);
    const entries = fs.readdirSync(dir);
    const now = Date.now();
    for (const entry of entries) {
      if (
        entry.startsWith(`${basename}.backup-`) ||
        entry.startsWith(`${basename}-wal.backup-`) ||
        entry.startsWith(`${basename}-shm.backup-`) ||
        entry.startsWith(`${basename}.tmp-`)
      ) {
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

function runPragmaIntegrityCheck(dbPath: string): { ok: boolean; detail?: string } {
  try {
    const { DatabaseSync } = loadSqlite();
    const db = new DatabaseSync(dbPath, { readOnly: true, timeout: 5000 });
    try {
      const row = db.prepare("PRAGMA integrity_check").get() as { integrity_check?: string } | undefined;
      const result = String(row?.integrity_check ?? "");
      if (result.toLowerCase() !== "ok") {
        return { ok: false, detail: result };
      }
      return { ok: true };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "integrity check failed" };
  }
}

function openReadOnlyCursorDb(): SqliteDb {
  const dbPath = getCursorGlobalStoragePath();

  if (!fs.existsSync(dbPath)) {
    throw new Error("Cursor storage database not found");
  }

  const integrityCheck = validateDatabaseIntegrity(dbPath);
  if (!integrityCheck.valid) {
    throw new Error(
      `Cursor storage database looks damaged (${integrityCheck.reason}). ` +
        "Quit Cursor, remove state.vscdb-wal and state.vscdb-shm, then restart Cursor before using this extension."
    );
  }

  const { DatabaseSync } = loadSqlite();
  return new DatabaseSync(dbPath, {
    readOnly: true,
    timeout: 5000,
  });
}

/** Run a read-only callback against Cursor's state.vscdb. Always closes the handle. */
export function withReadOnlyCursorDb<T>(fn: (db: SqliteDb) => T): T {
  const db = openReadOnlyCursorDb();
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function readCursorKeyDirect(key: string): string | null {
  const dbPath = getCursorGlobalStoragePath();
  if (!fs.existsSync(dbPath)) {
    return null;
  }

  return withReadOnlyCursorDb((db) => {
    const row = db
      .prepare("SELECT value FROM ItemTable WHERE key = ?")
      .get(key) as { value?: unknown } | undefined;
    return typeof row?.value === "string" ? row.value : null;
  });
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

/**
 * Quit-then-write fallback. Refuses while the editor process is running.
 * Backs up db+wal+shm, updates in place, runs PRAGMA integrity_check, restores on failure.
 */
export async function applyComposerFallbackModel(): Promise<{
  success: boolean;
  error?: string;
  alreadySet?: boolean;
}> {
  const host = detectEditorHost();
  if (isEditorProcessRunning(host)) {
    return {
      success: false,
      error:
        "Cursor/VS Code is still running. Quit the editor completely, then run Apply Free Fallback Model again. Live writes are disabled to protect your data.",
    };
  }

  const dbPath = getCursorGlobalStoragePath(host);
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

  const backupBundle = createFullBackup(dbPath);
  if (!backupBundle) {
    return { success: false, error: "Failed to create database backup (aborting write)" };
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
      const after = runPragmaIntegrityCheck(dbPath);
      if (!after.ok) {
        restoreFullBackup(backupBundle);
        cleanupFullBackup(backupBundle);
        return {
          success: false,
          error: `Post-write integrity check failed (${after.detail}). Restored backup.`,
        };
      }
      // Keep backup for one session window (stale cleaner removes later).
      return attemptResult;
    }

    const restored = restoreFullBackup(backupBundle);
    if (!restored) {
      cleanupFullBackup(backupBundle);
      return { success: false, error: "Failed to restore backup for retry" };
    }

    attemptResult = await withTimeout(
      attemptModification(),
      DB_OPERATION_TIMEOUT_MS,
      "applyComposerFallbackModel (retry)"
    );

    if (attemptResult.success) {
      const after = runPragmaIntegrityCheck(dbPath);
      if (!after.ok) {
        restoreFullBackup(backupBundle);
        cleanupFullBackup(backupBundle);
        return {
          success: false,
          error: `Post-write integrity check failed (${after.detail}). Restored backup.`,
        };
      }
      return attemptResult;
    }

    restoreFullBackup(backupBundle);
    cleanupFullBackup(backupBundle);
    return {
      success: false,
      error: attemptResult.error || "Failed to apply fallback model after retry",
    };
  } catch (error) {
    restoreFullBackup(backupBundle);
    cleanupFullBackup(backupBundle);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during fallback model application",
    };
  }
}

export async function readCachedAccountEmail(): Promise<string | null> {
  return readCursorKeyDirect("cursorAuth/cachedEmail");
}
