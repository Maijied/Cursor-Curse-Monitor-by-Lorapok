import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SITE_DATA_URL = "https://cursor.lorapok.tech/site-data.json";

const SHARED_DIR = dirname(fileURLToPath(import.meta.url));

function localSiteDataCandidates(env) {
  const paths = [];
  const explicit =
    (typeof env?.SITE_DATA_FILE === "string" && env.SITE_DATA_FILE.trim()) ||
    (typeof process !== "undefined" && process.env?.SITE_DATA_FILE?.trim()) ||
    "";
  if (explicit) paths.push(explicit);
  paths.push(join(SHARED_DIR, "../../../../site-data.json"));
  return paths;
}

async function tryReadLocalSiteData(env) {
  let fs;
  try {
    fs = await import("node:fs");
  } catch {
    return null;
  }

  for (const candidate of localSiteDataCandidates(env)) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    try {
      return JSON.parse(fs.readFileSync(candidate, "utf8"));
    } catch {
      // try next candidate
    }
  }
  return null;
}

function shouldPreferLocalSiteData(env) {
  return (
    Boolean(env?.SITE_DATA_FILE) ||
    Boolean(typeof process !== "undefined" && process.env?.SITE_DATA_FILE) ||
    Boolean(typeof process !== "undefined" && process.env?.CI === "true") ||
    Boolean(typeof process !== "undefined" && process.env?.NODE_ENV === "test") ||
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
    (typeof process !== "undefined" ? process.env?.SITE_DATA_URL : undefined) ??
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
