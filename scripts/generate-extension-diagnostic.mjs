#!/usr/bin/env node
/**
 * Writes extension-dashboard diagnostic log (paths, auth DB, env).
 * Usage: node scripts/generate-extension-diagnostic.mjs [--out path]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function dbPathForProduct(product) {
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

function statDb(dbPath) {
  try {
    const st = fs.statSync(dbPath);
    return { exists: true, bytes: st.size, mtime: st.mtime.toISOString() };
  } catch {
    return { exists: false };
  }
}

function readAuthFlags(dbPath) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    return { sqlite: "unavailable", hasToken: false, email: null };
  }
  if (!fs.existsSync(dbPath)) {
    return { sqlite: "ok", hasToken: false, email: null, reason: "db missing" };
  }
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const tokenRow = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get("cursorAuth/accessToken");
    const emailRow = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get("cursorAuth/cachedEmail");
    db.close();
    const token = tokenRow?.value;
    const email = emailRow?.value ?? null;
    return {
      sqlite: "ok",
      hasToken: typeof token === "string" && token.length > 8,
      email: typeof email === "string" ? email : null,
    };
  } catch (err) {
    return { sqlite: "error", hasToken: false, email: null, reason: String(err?.message ?? err) };
  }
}

async function main() {
  const outArg = process.argv.indexOf("--out");
  const defaultOut = path.join(repoRoot, ".vscode-dev", "extension-diagnostic.log");
  const outPath = outArg >= 0 ? process.argv[outArg + 1] : defaultOut;

  const monitoringProduct =
    process.env.CCM_PRODUCT_DATA_FOLDER?.trim() ||
    (() => {
      const name = (process.env.VSCODE_APP_NAME || "").toLowerCase();
      if (name.includes("visual studio code") || name.includes("vscode") || name === "code") {
        return "Cursor";
      }
      if (name.includes("dcursor")) return "dCursor";
      if (name.includes("antigravity")) return "Antigravity IDE";
      if (name.includes("agy")) return "AGY";
      if (name.includes("cursor")) return "Cursor";
      return "Cursor";
    })();
  const hostProduct = (() => {
    const name = (process.env.VSCODE_APP_NAME || "").toLowerCase();
    if (name.includes("cursor")) return "Cursor";
    if (name.includes("visual studio code") || name.includes("vscode") || name === "code") return "Code";
    return process.env.CCM_PRODUCT_DATA_FOLDER?.trim() || "(unset)";
  })();

  const monitoringDb = process.env.CURSOR_DB_PATH || dbPathForProduct(monitoringProduct);
  const hostDb = dbPathForProduct(hostProduct === "(unset)" ? "Code" : hostProduct);

  const monitoringAuth = readAuthFlags(monitoringDb);
  const hostAuth = hostDb !== monitoringDb ? readAuthFlags(hostDb) : null;

  const lines = [
    `# Cursor Curse Monitor — extension diagnostic`,
    `generatedAt: ${new Date().toISOString()}`,
    ``,
    `## Environment`,
    `platform: ${process.platform}`,
    `node: ${process.version}`,
    `VSCODE_APP_NAME: ${process.env.VSCODE_APP_NAME ?? "(unset)"}`,
    `CCM_DEV_IDE: ${process.env.CCM_DEV_IDE ?? "(unset)"}`,
    `CCM_PRODUCT_DATA_FOLDER: ${process.env.CCM_PRODUCT_DATA_FOLDER ?? "(unset, defaults to Cursor for monitoring)"}`,
    `CURSOR_DB_PATH: ${process.env.CURSOR_DB_PATH ?? "(unset)"}`,
    ``,
    `## Monitoring DB (auth + usage reads)`,
    `product: ${monitoringProduct}`,
    `path: ${monitoringDb}`,
    `stat: ${JSON.stringify(statDb(monitoringDb))}`,
    `auth: ${JSON.stringify(monitoringAuth)}`,
    ``,
    `## Host IDE DB (what VS Code/Cursor extension host would use without CCM_PRODUCT_DATA_FOLDER)`,
    `inferredProduct: ${hostProduct}`,
    `path: ${hostDb}`,
    `stat: ${JSON.stringify(statDb(hostDb))}`,
    hostAuth ? `auth: ${JSON.stringify(hostAuth)}` : `auth: (same as monitoring)`,
    ``,
    `## Diagnosis`,
  ];

  if (!monitoringAuth.hasToken && hostAuth?.hasToken) {
    lines.push(
      `LIKELY_ISSUE: Extension host reads ${hostProduct} DB but monitoring is pointed at ${monitoringProduct}.`,
      `FIX: In Antigravity/Cursor forks, leave CCM_PRODUCT_DATA_FOLDER unset so the host editor DB is used.`,
      `FIX: In VS Code only, set CCM_PRODUCT_DATA_FOLDER=Cursor in launch.json.`
    );
  } else if (!monitoringAuth.hasToken) {
    lines.push(
      `LIKELY_ISSUE: No cursorAuth/accessToken in monitoring DB.`,
      `FIX: Sign in to Cursor, or add a saved account in the extension switcher.`
    );
  } else {
    lines.push(`Auth token present in monitoring DB — dashboard should be able to fetch usage.`);
  }

  if (monitoringDb !== hostDb && !process.env.CCM_PRODUCT_DATA_FOLDER && process.env.VSCODE_APP_NAME?.toLowerCase().includes("code")) {
    lines.push(
      `WARNING: Running under VS Code without CCM_PRODUCT_DATA_FOLDER — extension may look at wrong DB unless code uses getMonitoringStoragePath().`
    );
  }

  const body = `${lines.join("\n")}\n`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
