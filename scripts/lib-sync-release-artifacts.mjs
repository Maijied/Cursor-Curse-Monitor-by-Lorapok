/**
 * Keep committed site artifacts aligned with package.json without full site:data regeneration.
 * Marks ahead-of-GitHub bumps as release candidates so validate:release stays honest.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildProductContext } from "./lib-product-context.mjs";

const DEFAULT_REPO = "Maijied/Cursor-Curse-Monitor-by-Lorapok";

export function normalizedVersion(value) {
  return String(value ?? "").replace(/^v/, "");
}

async function fetchLatestPublishedVersion(repo, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "cursor-curse-monitor-sync",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.tag_name) return null;
  return normalizedVersion(data.tag_name);
}

/**
 * @param {string} root
 * @param {string} version
 * @param {Record<string, unknown>} [pkg]
 * @param {{ githubToken?: string }} [options]
 */
export async function syncReleaseArtifactVersions(root, version, pkg, options = {}) {
  const sitePath = join(root, "website/site-data.json");
  const seoPath = join(root, "website/seo.json");
  const indexPath = join(root, "website/index.html");
  const pkgPath = join(root, "package.json");

  const packageJson = pkg ?? JSON.parse(readFileSync(pkgPath, "utf8"));
  const site = JSON.parse(readFileSync(sitePath, "utf8"));
  const repo =
    String(site.github?.repo ?? DEFAULT_REPO).replace(/^https?:\/\/github\.com\//, "");

  let publishedReleaseVersion =
    normalizedVersion(site.publishedReleaseVersion) ||
    normalizedVersion(site.github?.releaseTag) ||
    null;

  const livePublished = await fetchLatestPublishedVersion(repo, options.githubToken);
  if (livePublished) {
    publishedReleaseVersion = livePublished;
  }

  const releaseStatus =
    publishedReleaseVersion && publishedReleaseVersion === normalizedVersion(version)
      ? "published"
      : "candidate";

  let syncStatus = site.syncStatus ?? "pending";
  if (releaseStatus !== "published" && syncStatus === "synced") {
    syncStatus = "release-candidate";
  }

  site.version = version;
  site.packageVersion = version;
  site.publishedReleaseVersion = publishedReleaseVersion;
  site.releaseStatus = releaseStatus;
  site.syncStatus = syncStatus;

  if (site.install && typeof site.install === "object") {
    site.install.releaseTag = `./scripts/release.sh ${version}`;
  }

  site.productContext = buildProductContext(packageJson, { publishedReleaseVersion });

  writeFileSync(sitePath, `${JSON.stringify(site, null, 2)}\n`, "utf8");

  const seo = JSON.parse(readFileSync(seoPath, "utf8"));
  seo.version = version;
  seo.packageVersion = version;
  if (seo.structuredData?.softwareApplication && typeof seo.structuredData.softwareApplication === "object") {
    seo.structuredData.softwareApplication.softwareVersion = version;
  }
  if (releaseStatus !== "published" && seo.syncStatus === "synced") {
    seo.syncStatus = "release-candidate";
  }
  writeFileSync(seoPath, `${JSON.stringify(seo, null, 2)}\n`, "utf8");

  if (existsSync(indexPath)) {
    const indexHtml = readFileSync(indexPath, "utf8");
    const updated = indexHtml.replace(
      /"softwareVersion"\s*:\s*"[^"]+"/g,
      `"softwareVersion": "${version}"`,
    );
    if (updated !== indexHtml) {
      writeFileSync(indexPath, updated, "utf8");
    }
  }

  return { releaseStatus, publishedReleaseVersion, syncStatus };
}
