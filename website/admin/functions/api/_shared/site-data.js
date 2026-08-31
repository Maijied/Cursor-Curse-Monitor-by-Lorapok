const DEFAULT_SITE_DATA_URL = "https://cursor.lorapok.tech/site-data.json";

/** True only in real Node (tests/scripts), not Cloudflare Workers (even with nodejs_compat). */
function isNodeRuntime() {
  if (typeof WebSocketPair !== "undefined") return false;
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}

function explicitSiteDataFile(env) {
  return (
    (typeof env?.SITE_DATA_FILE === "string" && env.SITE_DATA_FILE.trim()) ||
    (isNodeRuntime() && process.env?.SITE_DATA_FILE?.trim()) ||
    ""
  );
}

async function tryReadLocalSiteData(env) {
  if (!isNodeRuntime()) return null;

  let readFileSync;
  let existsSync;
  let pathJoin;
  let sharedDir;
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const url = await import("node:url");
    readFileSync = fs.readFileSync;
    existsSync = fs.existsSync;
    pathJoin = path.join;
    sharedDir = path.dirname(url.fileURLToPath(import.meta.url));
  } catch {
    return null;
  }

  const paths = [];
  const explicit = explicitSiteDataFile(env);
  if (explicit) paths.push(explicit);
  paths.push(pathJoin(sharedDir, "../../../../site-data.json"));

  for (const candidate of paths) {
    if (!candidate || !existsSync(candidate)) continue;
    try {
      return JSON.parse(readFileSync(candidate, "utf8"));
    } catch {
      // try next candidate
    }
  }
  return null;
}

function shouldPreferLocalSiteData(env) {
  return (
    Boolean(explicitSiteDataFile(env)) ||
    Boolean(isNodeRuntime() && process.env?.CI === "true") ||
    Boolean(isNodeRuntime() && process.env?.NODE_ENV === "test") ||
    env?.PREFER_LOCAL_SITE_DATA === "true" ||
    env?.PREFER_LOCAL_SITE_DATA === true
  );
}

export async function fetchSiteData(env = {}) {
  if (shouldPreferLocalSiteData(env)) {
    const local = await tryReadLocalSiteData(env);
    if (local) return local;
  }

  const url =
    env?.SITE_DATA_URL ??
    (isNodeRuntime() ? process.env?.SITE_DATA_URL : undefined) ??
    DEFAULT_SITE_DATA_URL;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`site-data fetch failed (${res.status})`);
    return await res.json();
  } catch (error) {
    const local = await tryReadLocalSiteData(env);
    if (local) return local;
    throw error;
  }
}

export function tagsFromSiteData(data) {
  if (Array.isArray(data?.github?.tags) && data.github.tags.length > 0) {
    return data.github.tags;
  }
  if (data?.github?.releaseTag) return [data.github.releaseTag];
  if (data?.packageVersion) return [`v${String(data.packageVersion).replace(/^v/, "")}`];
  return [];
}

export function packageVersionFromSiteData(data) {
  const pkg = String(data?.packageVersion ?? "").replace(/^v/, "");
  const version = String(data?.version ?? "").replace(/^v/, "");
  if (pkg && pkg !== "0.0.0") return pkg;
  return version || pkg;
}

export function liveTagFromSiteData(data) {
  if (data?.github?.releaseTag) return String(data.github.releaseTag);
  const pkg = data?.packageVersion ?? data?.version;
  if (pkg) return `v${String(pkg).replace(/^v/i, "")}`;
  return null;
}
