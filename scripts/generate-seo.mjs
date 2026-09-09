#!/usr/bin/env node
/**
 * Generates SEO artifacts from website/seo.yml + package.json + site-data.json.
 * Emits seo.json, sitemap.xml, robots.txt, and syncs HTML <head> meta blocks.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import yaml from "js-yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const website = join(root, "website");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const seoConfig = yaml.load(readFileSync(join(website, "seo.yml"), "utf8"));

const SITE_BASE = (seoConfig.site?.base ?? pkg.homepage ?? "").replace(/\/$/, "");

/**
 * Reads optional site metadata from the website configuration file.
 * @return {Object|null} The parsed site metadata, or `null` when the file is absent.
 */
function readSiteData() {
  const path = join(website, "site-data.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/**
 * Retrieves the latest Git commit date for a file.
 * @param {string} file - The path to the file.
 * @return {string} The commit date in `YYYY-MM-DD` format, or the current date if unavailable.
 */
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

/**
 * Replaces recognized variable placeholders in text with their corresponding values.
 * @param {string} text - The text containing `{variable}` placeholders.
 * @param {Object} vars - The values to substitute for matching variable names.
 * @returns {string} The text with matching placeholders replaced and unknown placeholders preserved.
 */
function interpolate(text, vars) {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

const siteData = readSiteData();
const version = siteData?.version ?? pkg.version;
const generatedAt = new Date().toISOString();

const firefoxPublished = Boolean(siteData?.browserExtension?.firefox?.published);
const vars = {
  displayName: pkg.displayName ?? pkg.name,
  version: siteData?.version ?? pkg.version,
  vsixUrl: siteData?.github?.vsixUrl ?? `${SITE_BASE}/releases/latest`,
  packageVersion: version,
  siteBase: SITE_BASE,
  firefoxDownloadUrl: firefoxPublished
    ? (siteData?.browserExtension?.firefox?.url ?? siteData?.productContext?.firefoxUrl)
    : (siteData?.github?.releaseUrl ?? `${SITE_BASE}/`),
  chromeDownloadUrl:
    siteData?.browserExtension?.chrome?.zipUrl ??
    siteData?.productContext?.chromeZipUrl ??
    `${SITE_BASE}/releases/latest`,
  missionControlUrl: siteData?.company?.adminUrl ?? siteData?.productContext?.adminUrl ?? "https://cursor-dev.lorapok.tech",
};

/**
 * Converts a page path into an absolute site URL.
 * @param {string} path - The page path, with or without a leading slash.
 * @return {string} The absolute URL for the page.
 */
function pageUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p === "/" ? `${SITE_BASE}/` : `${SITE_BASE}${p}`;
}

/**
 * Resolves an image path to an absolute URL.
 * @param {string} path - The image path or URL.
 * @return {string} The absolute image URL, using the default social-card image when no path is provided.
 */
function absImage(path) {
  if (!path) return `${SITE_BASE}/assets/marketing/og-social-card.png`;
  if (path.startsWith("http")) return path;
  return `${SITE_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Builds SEO-related HTML metadata for a configured page.
 * @param {Object} pageCfg - The page configuration containing title, description, path, and optional social metadata.
 * @return {Object} The generated metadata lines and resolved page values, including title, description, canonical URL, keywords, and social metadata.
 */
function buildHeadBlock(pageKey, pageCfg) {
  const title = interpolate(pageCfg.title, vars);
  const description = interpolate(pageCfg.description, vars);
  const canonical = pageUrl(pageCfg.path);
  const keywords = [...(pageCfg.keywords ?? []), ...(pkg.keywords ?? [])].filter(Boolean);
  const uniqueKeywords = [...new Set(keywords)];
  const ogTitle = interpolate(pageCfg.ogTitle ?? pageCfg.title, vars);
  const ogDescription = interpolate(pageCfg.ogDescription ?? pageCfg.description, vars);
  const twitterTitle = interpolate(pageCfg.twitterTitle ?? ogTitle, vars);
  const twitterDescription = interpolate(pageCfg.twitterDescription ?? ogDescription, vars);
  const ogImage = absImage(seoConfig.openGraph?.image);

  const lines = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
  ];
  if (uniqueKeywords.length) {
    lines.push(`<meta name="keywords" content="${escapeAttr(uniqueKeywords.join(", "))}" />`);
  }
  if (seoConfig.site?.author) {
    lines.push(`<meta name="author" content="${escapeAttr(seoConfig.site.author)}" />`);
  }
  lines.push(`<link rel="canonical" href="${escapeAttr(canonical)}" />`);
  lines.push(`<meta property="og:type" content="${escapeAttr(seoConfig.openGraph?.type ?? "website")}" />`);
  lines.push(`<meta property="og:title" content="${escapeAttr(ogTitle)}" />`);
  lines.push(`<meta property="og:description" content="${escapeAttr(ogDescription)}" />`);
  lines.push(`<meta property="og:url" content="${escapeAttr(canonical)}" />`);
  if (seoConfig.site?.locale) {
    lines.push(`<meta property="og:locale" content="${escapeAttr(seoConfig.site.locale)}" />`);
  }
  lines.push(`<meta property="og:image" content="${escapeAttr(ogImage)}" />`);
  lines.push(`<meta name="twitter:card" content="${escapeAttr(seoConfig.twitter?.card ?? "summary_large_image")}" />`);
  lines.push(`<meta name="twitter:title" content="${escapeAttr(twitterTitle)}" />`);
  lines.push(`<meta name="twitter:description" content="${escapeAttr(twitterDescription)}" />`);
  if (seoConfig.twitter?.card?.includes("large")) {
    lines.push(`<meta name="twitter:image" content="${escapeAttr(ogImage)}" />`);
  }

  return { lines: lines.join("\n  "), title, description, canonical, keywords: uniqueKeywords, ogTitle, ogDescription, twitterTitle, twitterDescription, ogImage };
}

/**
 * Escapes characters with special meaning in HTML text.
 * @param {*} s - The value to escape.
 * @return {string} The HTML-safe text.
 */
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Escapes text for safe use in an HTML attribute value.
 * @param {*} s - The value to escape.
 * @return {string} The HTML-escaped attribute value.
 */
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

/**
 * Reads social profile URLs for JSON-LD sameAs.
 * @return {string[]} Unique absolute profile URLs.
 */
function readSameAsUrls() {
  const fromYaml = seoConfig.organization?.sameAs ?? [];
  const yamlUrls = fromYaml.map((u) => interpolate(String(u), vars)).filter(Boolean);
  const socialPath = join(website, "social.json");
  if (!existsSync(socialPath)) return [...new Set(yamlUrls)];
  try {
    const social = JSON.parse(readFileSync(socialPath, "utf8"));
    const extra = [
      social.brand?.labs,
      social.brand?.github,
      social.brand?.linkedin,
      social.brand?.x,
      social.brand?.reddit,
      social.brand?.instagram,
      social.brand?.facebook,
      social.community?.discord,
      siteData?.repository,
      siteData?.github?.releaseUrl,
    ].filter(Boolean);
    return [...new Set([...yamlUrls, ...extra])];
  } catch {
    return [...new Set(yamlUrls)];
  }
}

/**
 * Builds privacy-aligned indexing policy metadata for seo.json (SEO-03).
 * @return {Object} Indexing policy block consumed by admin SEO dashboard.
 */
function buildIndexingPolicy() {
  const indexing = seoConfig.indexing ?? {};
  const adminUrls = (indexing.adminUrls ?? [vars.missionControlUrl]).map((url) =>
    interpolate(String(url), vars).replace(/\/+$/, "")
  );
  return {
    adminNoindex: indexing.adminNoindex !== false,
    marketingAllow: indexing.marketingAllow !== false,
    adminUrls: [...new Set(adminUrls.filter(Boolean))],
    policySummary: interpolate(
      indexing.policySummary ??
        "Mission Control admin is excluded from search indexes; the marketing site is indexable.",
      vars
    ),
    sitemapUrl: `${SITE_BASE}/sitemap.xml`,
    robotsUrl: `${SITE_BASE}/robots.txt`,
    organizationSchema: true,
    softwareApplicationSchema: true,
  };
}

/**
 * Builds the Schema.org JSON-LD graph for the configured structured data.
 * @return {string} A formatted JSON-LD document containing the Schema.org context and graph.
 */
function buildJsonLd(pageKey = "index", pageMetaForPage = null) {
  const sameAs = readSameAsUrls();
  const nodesById = new Map();

  for (const item of seoConfig.structuredData?.graph ?? []) {
    const node = {
      "@type": item.type ?? "SoftwareApplication",
    };
    if (item.id) node["@id"] = `${SITE_BASE}/#${item.id}`;

    if (item.type === "Organization") {
      node.name = interpolate(item.name ?? seoConfig.organization?.name ?? "Lorapok Labs", vars);
      node.url = interpolate(item.url ?? seoConfig.organization?.url ?? "https://lorapok.tech", vars);
      const logoPath = item.logo ?? seoConfig.organization?.logo;
      if (logoPath) node.logo = absImage(logoPath);
      if (sameAs.length) node.sameAs = sameAs;
    } else if (item.type === "WebSite") {
      node.name = interpolate(item.name ?? vars.displayName, vars);
      node.url = interpolate(item.url ?? `${SITE_BASE}/`, vars);
      node.description = interpolate(seoConfig.website?.description ?? pageMetaForPage?.description ?? "", vars);
      if (item.publisher === "organization") {
        node.publisher = { "@id": `${SITE_BASE}/#organization` };
      }
    } else {
      node.name = interpolate(item.name, vars);
      if (item.applicationCategory) node.applicationCategory = item.applicationCategory;
      if (item.operatingSystem) node.operatingSystem = item.operatingSystem;
      node.offers = { "@type": "Offer", price: "0", priceCurrency: "USD" };
      if (item.featureList) node.featureList = item.featureList;
      if (item.downloadUrl) {
        const resolved = interpolate(item.downloadUrl, vars);
        if (item.id === "browser_extension" && !firefoxPublished) {
          node.downloadUrl = siteData?.github?.releaseUrl ?? resolved;
        } else if (item.id === "browser_extension") {
          node.downloadUrl = resolved;
        } else {
          node.downloadUrl = resolved;
        }
      }
      if (item.id === "ide_extension") {
        node.softwareVersion = version;
        node.author = {
          "@type": "Person",
          name: pkg.author?.name ?? seoConfig.site?.author,
          url: pkg.author?.url ?? pkg.repository?.url,
        };
      }
      if (item.publisher === "organization") {
        node.publisher = { "@id": `${SITE_BASE}/#organization` };
      } else {
        node.publisher = {
          "@type": "Organization",
          name: "Lorapok Labs",
          url: "https://lorapok.tech",
        };
      }
    }

    if (item.id) nodesById.set(item.id, node);
  }

  if (pageKey !== "index" && pageMetaForPage) {
    nodesById.set("page", {
      "@type": "WebPage",
      "@id": pageMetaForPage.canonical,
      url: pageMetaForPage.canonical,
      name: pageMetaForPage.title,
      description: pageMetaForPage.description,
      isPartOf: { "@id": `${SITE_BASE}/#website` },
      publisher: { "@id": `${SITE_BASE}/#organization` },
    });
  }

  const graph = [...nodesById.values()];
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2);
}

/**
 * Synchronizes SEO metadata and structured data in an HTML file.
 * @param {string} htmlPath - The path to the HTML file relative to the website directory.
 * @param {string} headLines - The SEO metadata to place in the document head.
 * @param {string} jsonLd - The serialized structured data to place in the document.
 */
function injectSeoBlock(htmlPath, headLines, jsonLd) {
  const fullPath = join(website, htmlPath);
  if (!existsSync(fullPath)) {
    console.warn(`Skip HTML inject — missing ${htmlPath}`);
    return;
  }
  let html = readFileSync(fullPath, "utf8");
  const headBlock = `<!-- seo:begin -->\n  ${headLines}\n  <!-- seo:end -->`;
  const jsonBlock = jsonLd
    ? `<!-- seo:jsonld -->\n  <script type="application/ld+json">\n  ${jsonLd}\n  </script>\n  <!-- /seo:jsonld -->`
    : "";

  if (html.includes("<!-- seo:begin -->")) {
    html = html.replace(/<!-- seo:begin -->[\s\S]*?<!-- seo:end -->/, headBlock);
    // Remove legacy duplicate meta immediately after seo:end (first-run migration)
    html = html.replace(
      /<!-- seo:end -->\s*(?:<meta name="description"[\s\S]*?<meta name="twitter:description"[^>]*>\s*)+/,
      "<!-- seo:end -->\n  "
    );
  } else if (html.includes("<title>")) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, headBlock);
  }

  if (jsonLd) {
    if (html.includes("<!-- seo:jsonld -->")) {
      html = html.replace(/<!-- seo:jsonld -->[\s\S]*?<!-- \/seo:jsonld -->/, jsonBlock);
    } else if (html.includes("<!-- seo:end -->")) {
      html = html.replace(/<!-- seo:end -->/, `<!-- seo:end -->\n  ${jsonBlock}`);
    } else if (htmlPath === "index.html") {
      html = html.replace(
        /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
        jsonBlock
      );
    }
  }

  writeFileSync(fullPath, html);
}

const pageMeta = {};
const sitemapPages = [];

for (const [key, pageCfg] of Object.entries(seoConfig.pages ?? {})) {
  const built = buildHeadBlock(key, pageCfg);
  pageMeta[key] = built;
  const htmlFile = pageCfg.file ?? `${key}.html`;
  const jsonLd = buildJsonLd(key, built);
  injectSeoBlock(htmlFile, built.lines, jsonLd);
  sitemapPages.push({
    loc: built.canonical,
    priority: pageCfg.priority ?? "0.5",
    changefreq: pageCfg.changefreq ?? "monthly",
    file: `website/${htmlFile}`,
  });
}

const urlEntries = sitemapPages
  .map(
    (p) => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${lastGitDate(p.file)}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join("\n");

writeFileSync(
  join(website, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`
);

writeFileSync(
  join(website, "robots.txt"),
  `User-agent: *
Allow: /

Sitemap: ${SITE_BASE}/sitemap.xml
`
);

const indexMeta = pageMeta.index ?? buildHeadBlock("index", seoConfig.pages?.index ?? {});

const seo = {
  generatedAt,
  source: "website/seo.yml",
  siteBase: SITE_BASE,
  title: indexMeta.title,
  description: indexMeta.description,
  version,
  packageVersion: version,
  canonical: indexMeta.canonical,
  syncStatus: siteData?.syncStatus ?? "unknown",
  keywords: indexMeta.keywords,
  openGraph: {
    type: seoConfig.openGraph?.type ?? "website",
    locale: seoConfig.site?.locale ?? "en_US",
    title: indexMeta.ogTitle,
    description: indexMeta.ogDescription,
    url: indexMeta.canonical,
    image: indexMeta.ogImage,
  },
  twitter: {
    card: seoConfig.twitter?.card ?? "summary_large_image",
    title: indexMeta.twitterTitle,
    description: indexMeta.twitterDescription,
    image: indexMeta.ogImage,
  },
  pages: Object.fromEntries(
    Object.entries(pageMeta).map(([k, m]) => [
      k,
      { title: m.title, description: m.description, canonical: m.canonical },
    ])
  ),
  marketplaces: {
    openVsxCanonical: siteData?.ovsx?.url ?? `https://open-vsx.org/extension/lorapok-labs/${pkg.name}`,
    openVsxDuplicate: siteData?.ovsxDuplicate?.url ?? null,
    vscode: siteData?.vscode?.url ?? `https://marketplace.visualstudio.com/items?itemName=LorapokLabs.${pkg.name}`,
    firefox: siteData?.browserExtension?.firefox?.url ?? siteData?.productContext?.firefoxUrl ?? null,
    chromeZip: vars.chromeDownloadUrl,
    github: siteData?.github?.releaseUrl ?? SITE_BASE,
    missionControl: vars.missionControlUrl,
    lorapokLabs: seoConfig.organization?.url ?? "https://lorapok.tech",
  },
  sameAs: readSameAsUrls(),
  structuredData: JSON.parse(buildJsonLd("index", indexMeta)),
  indexingPolicy: buildIndexingPolicy(),
};

writeFileSync(join(website, "seo.json"), JSON.stringify(seo, null, 2) + "\n");

console.log(`Wrote ${join(website, "sitemap.xml")}`);
console.log(`Wrote ${join(website, "robots.txt")}`);
console.log(`Wrote ${join(website, "seo.json")}`);
console.log(`Synced HTML meta for ${Object.keys(seoConfig.pages ?? {}).length} page(s)`);
console.log(`  Version: ${version}`);
console.log(`  Sync:    ${seo.syncStatus}`);
