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

let runtimeAppName: string | undefined;

/** Set from vscode.env.appName during extension activation (VSCODE_APP_NAME is often unset). */
export function setRuntimeAppName(appName: string | undefined): void {
  runtimeAppName = appName?.trim() || undefined;
}

function effectiveAppName(appName?: string): string | undefined {
  const name = appName || runtimeAppName || process.env.VSCODE_APP_NAME;
  return name?.trim() || undefined;
}

export interface DiscoveredCursorLogin {
  productFolder: string;
  dbPath: string;
  email: string | null;
  hasToken: boolean;
}

const MONITORING_PRODUCT_PRIORITY = [
  "Cursor",
  "dCursor",
  "Antigravity IDE",
  "Antigravity",
  "AGY",
  "Windsurf",
  "Void",
  "Trae",
  "Kiro",
  "Codex",
];

function getConfigRoot(): string {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support");
  }
  if (process.platform === "win32") {
    return process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
  }
  return path.join(home, ".config");
}

function productSortScore(product: string): number {
  const idx = MONITORING_PRODUCT_PRIORITY.indexOf(product);
  return idx >= 0 ? idx : 100;
}

function configDbPath(product: string): string {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", product, "User", "globalStorage", "state.vscdb");
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
      product,
      "User",
      "globalStorage",
      "state.vscdb"
    );
  }
  return path.join(home, ".config", product, "User", "globalStorage", "state.vscdb");
}

function firstExistingProductDb(candidates: string[]): string | null {
  for (const product of candidates) {
    if (fs.existsSync(configDbPath(product))) {
      return product;
    }
  }
  return null;
}

/** VS Code–compatible product folder under OS app-data roots (Code, Cursor, Windsurf, …). */
export function resolveProductDataFolder(appName?: string): string | null {
  if (process.env.CCM_PRODUCT_DATA_FOLDER?.trim()) {
    return process.env.CCM_PRODUCT_DATA_FOLDER.trim();
  }
  const name = (effectiveAppName(appName) || "").toLowerCase();
  // Order matters: dCursor before Cursor; Antigravity before generic AGY.
  if (name.includes("dcursor")) {
    return firstExistingProductDb(["dCursor", "Cursor"]) ?? "dCursor";
  }
  if (name.includes("antigravity")) {
    return firstExistingProductDb(["Antigravity IDE", "Antigravity", "AGY"]) ?? "Antigravity IDE";
  }
  if (name.includes("cursor")) {
    return "Cursor";
  }
  if (name.includes("windsurf")) return "Windsurf";
  if (name.includes("vscodium") || name.includes("codium")) return "VSCodium";
  if (name.includes("void")) return "Void";
  if (name.includes("trae")) return "Trae";
  if (name.includes("kiro")) return "Kiro";
  if (name.includes("positron")) return "Positron";
  if (name.includes("agy")) return firstExistingProductDb(["AGY", "Antigravity IDE", "Antigravity"]) ?? "AGY";
  if (name.includes("codex")) return "Codex";
  if (name.includes("visual studio code") || name.includes("vscode") || name === "code") {
    return "Code";
  }
  return null;
}

export function detectEditorHost(appName?: string): EditorHost {
  const name = (effectiveAppName(appName) || "").toLowerCase();
  if (name.includes("cursor") || name.includes("dcursor") || name.includes("windsurf") || name.includes("antigravity")) {
    return "cursor";
  }
  if (name.includes("visual studio code") || name.includes("vscode") || name === "code") {
    return "vscode";
  }
  return "unknown";
}

function readAuthKeysAtPath(dbPath: string): { token: string | null; email: string | null } {
  if (!fs.existsSync(dbPath)) {
    return { token: null, email: null };
  }
  const integrity = validateDatabaseIntegrity(dbPath);
  if (!integrity.valid) {
    return { token: null, email: null };
  }
  try {
    const { DatabaseSync } = loadSqlite();
    const db = new DatabaseSync(dbPath, { readOnly: true, timeout: 3000 });
    try {
      const tokenRow = db
        .prepare("SELECT value FROM ItemTable WHERE key = ?")
        .get("cursorAuth/accessToken") as { value?: unknown } | undefined;
      const emailRow = db
        .prepare("SELECT value FROM ItemTable WHERE key = ?")
        .get("cursorAuth/cachedEmail") as { value?: unknown } | undefined;
      const token =
        typeof tokenRow?.value === "string" && tokenRow.value.trim().length > 8
          ? tokenRow.value.trim()
          : null;
      const email = typeof emailRow?.value === "string" ? emailRow.value.trim() || null : null;
      return { token, email };
    } finally {
      db.close();
    }
  } catch {
    return { token: null, email: null };
  }
}

/** Scan app-data folders for Cursor installs with a signed-in access token. */
export function discoverCursorAuthInstalls(): DiscoveredCursorLogin[] {
  let dirs: string[] = [];
  try {
    dirs = fs
      .readdirSync(getConfigRoot(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  const results: DiscoveredCursorLogin[] = [];
  for (const productFolder of dirs) {
    const dbPath = configDbPath(productFolder);
    if (!fs.existsSync(dbPath)) {
      continue;
    }
    const auth = readAuthKeysAtPath(dbPath);
    if (!auth.token) {
      continue;
    }
    results.push({
      productFolder,
      dbPath,
      email: auth.email,
      hasToken: true,
    });
  }

  results.sort((a, b) => {
    const score = productSortScore(a.productFolder) - productSortScore(b.productFolder);
    if (score !== 0) {
      return score;
    }
    return a.productFolder.localeCompare(b.productFolder);
  });
  return results;
}

export function readAuthFromProduct(productFolder: string): { token: string | null; email: string | null } {
  return readAuthKeysAtPath(configDbPath(productFolder));
}

function pickDefaultProductFolder(appName?: string): string {
  if (process.env.CCM_PRODUCT_DATA_FOLDER?.trim()) {
    return process.env.CCM_PRODUCT_DATA_FOLDER.trim();
  }
  const fromName = resolveProductDataFolder(appName);
  if (fromName && fs.existsSync(configDbPath(fromName))) {
    return fromName;
  }
  const discovered = discoverCursorAuthInstalls();
  const firstDiscovered = discovered[0];
  if (firstDiscovered) {
    return firstDiscovered.productFolder;
  }
  const host = detectEditorHost(appName);
  if (host === "vscode") {
    return "Code";
  }
  return firstExistingProductDb(["Cursor", "dCursor", "Antigravity IDE", "AGY", "Code"]) ?? "Cursor";
}

function appDataRoot(product: string): { darwin: string; win32: string; linux: string } {
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

function resolveProductForPath(host?: EditorHost, appName?: string): string {
  if (host === "vscode") {
    return "Code";
  }
  if (host === "cursor") {
    const folder = resolveProductDataFolder(appName);
    if (folder) {
      return folder;
    }
    return pickDefaultProductFolder(appName);
  }
  const folder = resolveProductDataFolder(appName);
  if (folder) {
    return folder;
  }
  return pickDefaultProductFolder(appName);
}

/** Editor User folder (parent of globalStorage and workspaceStorage). */
export function getUserConfigDir(host?: EditorHost, appName?: string): string {
  const product = resolveProductForPath(host, appName);
  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return path.join(home, "Library", "Application Support", product, "User");
    case "win32":
      return path.join(
        process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
        product,
        "User"
      );
    default:
      return path.join(home, ".config", product, "User");
  }
}

export function getWorkspaceStorageDir(host?: EditorHost, appName?: string): string {
  return path.join(getUserConfigDir(host, appName), "workspaceStorage");
}

/** Agent transcript roots (.cursor/projects, .agy/projects, …). */
export function resolveAgentProjectsRoot(host?: EditorHost, appName?: string): string {
  if (process.env.CCM_REINDEX_PROJECTS_ROOT) {
    return process.env.CCM_REINDEX_PROJECTS_ROOT;
  }
  const candidates = [
    path.join(os.homedir(), ".cursor", "projects"),
    path.join(os.homedir(), ".agy", "projects"),
    path.join(os.homedir(), ".codex", "projects"),
    path.join(os.homedir(), ".vscode", "projects"),
  ];
  if (host === "vscode") {
    candidates.unshift(path.join(os.homedir(), ".vscode", "projects"));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(os.homedir(), ".cursor", "projects");
}

/** Directory containing state.vscdb and conversation-search.db. */
export function getCursorGlobalStorageDir(host?: EditorHost, appName?: string): string {
  return path.dirname(getCursorGlobalStoragePath(host, appName));
}

/** Conversation search index used by Agents Window Ctrl+K. */
export function getConversationSearchDbPath(host?: EditorHost, appName?: string): string {
  if (process.env.CCM_REINDEX_SEARCH_DB) {
    return process.env.CCM_REINDEX_SEARCH_DB;
  }
  return path.join(getCursorGlobalStorageDir(host, appName), "conversation-search.db");
}

/** Resolve Cursor or VS Code globalStorage state.vscdb for the current host. */
export function getCursorGlobalStoragePath(host?: EditorHost, appName?: string): string {
  if (process.env.CURSOR_DB_PATH) {
    return process.env.CURSOR_DB_PATH;
  }
  const product = resolveProductForPath(host, appName);
  const roots = appDataRoot(product);
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
export function isEditorProcessRunning(host: EditorHost = detectEditorHost(), appName?: string): boolean {
  if (process.env.CURSOR_EDITOR_RUNNING === "1") return true;
  if (process.env.CURSOR_EDITOR_RUNNING === "0") return false;

  const product = resolveProductForPath(host, effectiveAppName(appName));
  const patterns =
    product === "Code"
      ? ["Code.exe", "code", "Code - OSS", "code-oss"]
      : product === "Cursor"
        ? ["Cursor.exe", "Cursor", "cursor"]
        : [`${product}.exe`, product, product.toLowerCase()];

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

/** Cursor product folder used for auth/usage SQLite (not the host IDE's Code DB). */
export function getMonitoringProductFolder(): string {
  if (process.env.CCM_PRODUCT_DATA_FOLDER?.trim()) {
    return process.env.CCM_PRODUCT_DATA_FOLDER.trim();
  }
  const appName = effectiveAppName();
  const host = detectEditorHost(appName);
  if (host === "vscode") {
    const discovered = discoverCursorAuthInstalls();
    const firstDiscovered = discovered[0];
    if (firstDiscovered) {
      return firstDiscovered.productFolder;
    }
    return firstExistingProductDb(["Cursor", "dCursor"]) ?? "Cursor";
  }
  const fromName = resolveProductDataFolder(appName);
  if (fromName && fromName !== "Code" && fs.existsSync(configDbPath(fromName))) {
    return fromName;
  }
  const discovered = discoverCursorAuthInstalls();
  const firstDiscovered = discovered[0];
  if (firstDiscovered) {
    return firstDiscovered.productFolder;
  }
  return fromName ?? firstExistingProductDb(["Cursor", "dCursor"]) ?? "Cursor";
}

/** Cursor or VS Code globalStorage state.vscdb used for usage monitoring auth. */
export function getMonitoringStoragePath(): string {
  if (process.env.CURSOR_DB_PATH) {
    return process.env.CURSOR_DB_PATH;
  }
  return configDbPath(getMonitoringProductFolder());
}

export function monitoringDbExists(): boolean {
  return fs.existsSync(getMonitoringStoragePath());
}

export function cursorDbExists(host?: EditorHost, appName?: string): boolean {
  return fs.existsSync(getCursorGlobalStoragePath(host, appName));
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

export function validateDatabaseIntegrity(dbPath: string): { valid: boolean; reason?: string } {
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
  const dbPath = getMonitoringStoragePath();

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
  const dbPath = getMonitoringStoragePath();
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

/**
 * Reads the local Cursor authentication token directly from SQLite reactive storage.
 * SECURITY: This token is sensitive and MUST NEVER be logged, serialized to telemetry,
 * or exposed in unhandled error messages.
 */
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
  const host = detectEditorHost(effectiveAppName());
  if (isEditorProcessRunning(host, effectiveAppName())) {
    return {
      success: false,
      error:
        "Cursor/VS Code is still running. Quit the editor completely, then run Apply Free Fallback Model again. Live writes are disabled to protect your data.",
    };
  }

  const dbPath = getMonitoringStoragePath();
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
