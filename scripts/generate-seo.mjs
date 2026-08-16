#!/usr/bin/env node
/**
 * Generates SEO artifacts: sitemap.xml, seo.json, robots.txt refresh.
 * Run after generate-site-data.mjs in CI or locally.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const website = join(root, "website");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const SITE_BASE = pkg.homepage?.replace(/\/$/, "") ?? "https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok";

function readSiteData() {
  const path = join(website, "site-data.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function readSocial() {
  const path = join(website, "social.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function lastGitDate(file) {
  try {
    const out = execSync(`git log -1 --format=%cs -- "${file}"`, {
      cwd: root,
      encoding: "utf8",
    }).trim();
    return out || isoDate();
  } catch {
    return isoDate();
  }
}

const siteData = readSiteData();
const social = readSocial();
const version = siteData?.version ?? pkg.version;
const generatedAt = new Date().toISOString();
const adminApiBase = social?.api?.base ?? "https://cursor-dev.lorapok.tech";
const sameAs = social?.brand ? Object.values(social.brand) : [];

const pages = [
  { loc: `${SITE_BASE}/`, priority: "1.0", changefreq: "weekly", file: "website/index.html" },
  { loc: `${SITE_BASE}/privacy.html`, priority: "0.6", changefreq: "monthly", file: "website/privacy.html" },
];

const urlEntries = pages
  .map(
    (p) => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${lastGitDate(p.file)}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

writeFileSync(join(website, "sitemap.xml"), sitemap);

const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_BASE}/sitemap.xml
`;

writeFileSync(join(website, "robots.txt"), robots);

const seo = {
  generatedAt,
  siteBase: SITE_BASE,
  adminApiBase,
  title: `${pkg.displayName} — Live Cursor Usage Dashboard`,
  description: pkg.description,
  version,
  canonical: SITE_BASE,
  syncStatus: siteData?.syncStatus ?? "unknown",
  social: social?.brand ?? {},
  keywords: [
    ...(pkg.keywords ?? []),
    "Cursor IDE",
    "Open VSX",
    "VS Code extension",
    "Lorapok Labs",
    "usage monitor",
  ],
  openGraph: {
    type: "website",
    title: pkg.displayName,
    description: pkg.description,
    url: SITE_BASE,
    image: `${SITE_BASE}/assets/marketing/og-social-card.png`,
  },
  marketplaces: {
    openVsxCanonical: siteData?.ovsx?.url ?? `https://open-vsx.org/extension/lorapok-labs/${pkg.name}`,
    openVsxDuplicate: siteData?.ovsxDuplicate?.url ?? null,
    vscode: siteData?.vscode?.url ?? `https://marketplace.visualstudio.com/items?itemName=LorapokLabs.${pkg.name}`,
    github: siteData?.github?.releaseUrl ?? `${SITE_BASE}`,
  },
  structuredData: {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: pkg.displayName,
    softwareVersion: version,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Windows, macOS, Linux",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    downloadUrl: siteData?.github?.vsixUrl ?? null,
    author: {
      "@type": "Person",
      name: pkg.author?.name,
      url: pkg.author?.url ?? pkg.repository?.url,
    },
    publisher: {
      "@type": "Organization",
      name: "Lorapok Labs",
      url: social?.brand?.labs ?? "https://lorapok.tech",
      sameAs,
    },
  },
};

writeFileSync(join(website, "seo.json"), JSON.stringify(seo, null, 2) + "\n");

console.log(`Wrote ${join(website, "sitemap.xml")}`);
console.log(`Wrote ${join(website, "robots.txt")}`);
console.log(`Wrote ${join(website, "seo.json")}`);
console.log(`  Version: ${version}`);
console.log(`  Sync:    ${seo.syncStatus}`);
