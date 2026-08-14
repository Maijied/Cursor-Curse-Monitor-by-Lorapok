import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyAdminRequest, jsonResponse } from "../_shared/auth.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return res.json();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  } catch {
    return jsonResponse({ error: "package.json unreadable" }, 500);
  }

  const name = pkg.name;
  const target = pkg.version.replace(/^v/, "");

  const [ovsxCanonical, ovsxDuplicate, vscodeRelease] = await Promise.all([
    fetchJson(`https://open-vsx.org/api/lorapok-labs/${name}`),
    fetchJson(`https://open-vsx.org/api/LorapokLabs/${name}`),
    fetchJson(`https://api.github.com/repos/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest`),
  ]);

  const channels = [
    {
      id: "github",
      label: "GitHub Release",
      version: vscodeRelease?.tag_name?.replace(/^v/, "") ?? null,
      synced: vscodeRelease?.tag_name?.replace(/^v/, "") === target,
    },
    {
      id: "ovsx-canonical",
      label: "Open VSX (lorapok-labs)",
      version: ovsxCanonical?.version ?? null,
      downloadCount: ovsxCanonical?.downloadCount ?? 0,
      synced: ovsxCanonical?.version === target,
    },
    {
      id: "ovsx-duplicate",
      label: "Open VSX duplicate",
      version: ovsxDuplicate?.version ?? null,
      downloadCount: ovsxDuplicate?.downloadCount ?? 0,
      synced: false,
      warn: true,
    },
    {
      id: "package",
      label: "package.json",
      version: target,
      synced: true,
    },
  ];

  const allSynced = channels.filter((c) => !c.warn).every((c) => c.synced);

  return jsonResponse({
    packageVersion: target,
    syncStatus: allSynced ? "synced" : "drift",
    channels,
    checkedAt: new Date().toISOString(),
  });
}
