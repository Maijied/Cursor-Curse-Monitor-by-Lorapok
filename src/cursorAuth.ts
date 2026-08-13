import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import initSqlJs, { Database } from "sql.js";

const REACTIVE_KEY =
  "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser";

export function getCursorGlobalStoragePath(): string {
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
    
    // Check if file is empty
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
  } catch (error) {
    return null;
  }
}

function restoreBackup(backupPath: string, originalPath: string): boolean {
  try {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, originalPath);
      fs.unlinkSync(backupPath);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

function cleanupBackup(backupPath: string): void {
  try {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
  } catch (error) {
    // Silently fail on cleanup
  }
}

function atomicWrite(dbPath: string, buffer: Buffer): { success: boolean; reason?: string } {
  try {
    const tempPath = `${dbPath}.tmp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    fs.writeFileSync(tempPath, buffer);
    
    // Verify the temp file was written successfully
    const tempStats = fs.statSync(tempPath);
    if (tempStats.size !== buffer.length) {
      fs.unlinkSync(tempPath);
      return { success: false, reason: "Temp file size mismatch" };
    }

    // Atomic replace operation
    fs.renameSync(tempPath, dbPath);
    
    // Verify the final file
    const finalStats = fs.statSync(dbPath);
    if (finalStats.size !== buffer.length) {
      return { success: false, reason: "Final file size mismatch after atomic replace" };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      reason: error instanceof Error ? error.message : "Unknown write error" 
    };
  }
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
      "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'"
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
): Promise<{ success: boolean; error?: string }> {
  const dbPath = getCursorGlobalStoragePath();
  if (!fs.existsSync(dbPath)) {
    return { success: false, error: "Database file does not exist" };
  }

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

  let db: Database | null = null;
  let retryAttempt = false;

  try {
    const attemptModification = async (): Promise<{ success: boolean; error?: string }> => {
      db = await openDatabase(dbPath, wasmPath);
      try {
        const result = db.exec(
          `SELECT value FROM ItemTable WHERE key = '${REACTIVE_KEY}'`
        );
        if (!result.length || !result[0].values.length) {
          return { success: false, error: "Reactive storage key not found in database" };
        }

        const raw = result[0].values[0][0];
        if (typeof raw !== "string") {
          return { success: false, error: "Reactive storage value is not a string" };
        }

        const data = JSON.parse(raw) as Record<string, unknown>;
        const aiSettings = (data.aiSettings ?? {}) as Record<string, unknown>;
        const modelConfig = (aiSettings.modelConfig ?? {}) as Record<
          string,
          unknown
        >;

        let changed = false;
        for (const surface of surfaces) {
          if (JSON.stringify(modelConfig[surface]) !== JSON.stringify(targetComposer)) {
            modelConfig[surface] = targetComposer;
            changed = true;
          }
        }

        if (!changed) {
          return { success: false, error: "Model configuration already set to target values" };
        }

        aiSettings.modelConfig = modelConfig;
        data.aiSettings = aiSettings;

        const updated = JSON.stringify(data);
        db.run("UPDATE ItemTable SET value = ? WHERE key = ?", [updated, REACTIVE_KEY]);

        const exported = db.export();
        
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
          db.close();
          db = null;
        }
      }
    };

    // Try modification
    let attemptResult = await attemptModification();

    // Step 5: Retry once if failed
    if (!attemptResult.success && !retryAttempt) {
      retryAttempt = true;
      // Restore from backup and retry
      if (restoreBackup(backupPath, dbPath)) {
        attemptResult = await attemptModification();
      } else {
        return { success: false, error: "Failed to restore backup for retry" };
      }
    }

    if (attemptResult.success) {
      cleanupBackup(backupPath);
      return { success: true };
    } else {
      // Restore backup on final failure
      restoreBackup(backupPath, dbPath);
      return { success: false, error: attemptResult.error || (retryAttempt ? "Failed to apply fallback model after retry" : "Failed to apply fallback model") };
    }
  } catch (error) {
    // Restore backup on any error
    restoreBackup(backupPath, dbPath);
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
      `SELECT value FROM ItemTable WHERE key = '${key.replace(/'/g, "''")}'`
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
