import * as fs from "fs";
import * as os from "os";
import * as path from "path";
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
): Promise<boolean> {
  const dbPath = getCursorGlobalStoragePath();
  if (!fs.existsSync(dbPath)) {
    return false;
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

  const db = await openDatabase(dbPath, wasmPath);
  try {
    const result = db.exec(
      `SELECT value FROM ItemTable WHERE key = '${REACTIVE_KEY}'`
    );
    if (!result.length || !result[0].values.length) {
      return false;
    }

    const raw = result[0].values[0][0];
    if (typeof raw !== "string") {
      return false;
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
      return false;
    }

    aiSettings.modelConfig = modelConfig;
    data.aiSettings = aiSettings;

    const updated = JSON.stringify(data);
    db.run("UPDATE ItemTable SET value = ? WHERE key = ?", [updated, REACTIVE_KEY]);

    const exported = db.export();
    fs.writeFileSync(dbPath, Buffer.from(exported));
    return true;
  } finally {
    db.close();
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
