#!/usr/bin/env node
/**
 * Generates SEO artifacts from website/seo.yml + package.json + site-data.json.
 * Emits seo.json, sitemap.xml, robots.txt, and syncs HTML <head> meta blocks.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { parse as parseYaml } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const website = join(root, "website");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const seoConfig = parseYaml(readFileSync(join(website, "seo.yml"), "utf8"));

const SITE_BASE = (seoConfig.site?.base ?? pkg.homepage ?? "").replace(/\/$/, "");

function readSiteData() {
  const path = join(website, "site-data.json");
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

function interpolate(text, vars) {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

const siteData = readSiteData();
const version = siteData?.packageVersion ?? siteData?.version ?? pkg.version;
const generatedAt = new Date().toISOString();

const vars = {
  displayName: pkg.displayName ?? pkg.name,
  version,
  vsixUrl: siteData?.github?.vsixUrl ?? `${SITE_BASE}/releases/latest`,
  packageVersion: pkg.version,
};

function pageUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p === "/" ? `${SITE_BASE}/` : `${SITE_BASE}${p}`;
}

function absImage(path) {
  if (!path) return `${SITE_BASE}/assets/marketing/og-social-card.png`;
  if (path.startsWith("http")) return path;
  return `${SITE_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

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
  lines.push(`<meta property="og:image" content="${escapeAttr(ogImage)}" />`);
  lines.push(`<meta name="twitter:card" content="${escapeAttr(seoConfig.twitter?.card ?? "summary_large_image")}" />`);
  lines.push(`<meta name="twitter:title" content="${escapeAttr(twitterTitle)}" />`);
  lines.push(`<meta name="twitter:description" content="${escapeAttr(twitterDescription)}" />`);
  if (seoConfig.twitter?.card?.includes("large")) {
    lines.push(`<meta name="twitter:image" content="${escapeAttr(ogImage)}" />`);
  }

  return { lines: lines.join("\n  "), title, description, canonical, keywords: uniqueKeywords, ogTitle, ogDescription, twitterTitle, twitterDescription, ogImage };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function buildJsonLd() {
  const graph = (seoConfig.structuredData?.graph ?? []).map((item) => {
    const node = {
      "@type": item.type ?? "SoftwareApplication",
      name: interpolate(item.name, vars),
      applicationCategory: item.applicationCategory,
      operatingSystem: item.operatingSystem,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    };
    if (item.featureList) node.featureList = item.featureList;
    if (item.downloadUrl) node.downloadUrl = interpolate(item.downloadUrl, vars);
    if (item.id === "ide_extension") {
      node.softwareVersion = version;
      node.author = {
        "@type": "Person",
        name: pkg.author?.name ?? seoConfig.site?.author,
        url: pkg.author?.url ?? pkg.repository?.url,
      };
    }
    node.publisher = {
      "@type": "Organization",
      name: "Lorapok Labs",
      url: "https://lorapok.tech",
    };
    return node;
  });

  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2);
}

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
  const jsonLd = key === "index" ? buildJsonLd() : null;
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
  packageVersion: pkg.version,
  canonical: indexMeta.canonical,
  syncStatus: siteData?.syncStatus ?? "unknown",
  keywords: indexMeta.keywords,
  openGraph: {
    type: seoConfig.openGraph?.type ?? "website",
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
    github: siteData?.github?.releaseUrl ?? SITE_BASE,
  },
  structuredData: JSON.parse(buildJsonLd()),
};

writeFileSync(join(website, "seo.json"), JSON.stringify(seo, null, 2) + "\n");

console.log(`Wrote ${join(website, "sitemap.xml")}`);
console.log(`Wrote ${join(website, "robots.txt")}`);
console.log(`Wrote ${join(website, "seo.json")}`);
console.log(`Synced HTML meta for ${Object.keys(seoConfig.pages ?? {}).length} page(s)`);
console.log(`  Version: ${version}`);
console.log(`  Sync:    ${seo.syncStatus}`);
