#!/usr/bin/env node
/**
 * WEB-09 / WEB-11 — generate public multi-page marketing shells from docs/wiki + templates.
 * Writes website/wiki/*.html, website/docs/index.html, releases.html, community.html,
 * and website/engineering/history/index.html.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { wikiMarkdownToHtml, mapWikiHref } from "./lib/wiki-markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const website = join(root, "website");
const wikiSrc = join(root, "docs/wiki");
const ASSET_V = "105f5292a052";

const PUBLIC_NAV = [
  { href: "index.html", label: "Home", match: "home" },
  { href: "wiki/index.html", label: "Wiki", match: "wiki" },
  { href: "releases.html", label: "Releases", match: "releases" },
  { href: "community.html", label: "Community", match: "community" },
  { href: "docs/index.html", label: "Docs", match: "docs" },
  { href: "privacy.html", label: "Privacy", match: "privacy" },
];

function assetPrefix(depth) {
  return depth <= 0 ? "./" : "../".repeat(depth);
}

function resolveNavHref(itemHref, depth) {
  const prefix = assetPrefix(depth);
  if (itemHref === "index.html") return `${prefix}`;
  return `${prefix}${itemHref}`;
}

function renderNav(active, depth) {
  return PUBLIC_NAV.map((item) => {
    const href = resolveNavHref(item.href, depth);
    const current = item.match === active ? ' aria-current="page"' : "";
    return `        <a href="${href}"${current}>${item.label}</a>`;
  }).join("\n");
}

function pageShell({
  title,
  description,
  canonicalPath,
  active,
  depth,
  eyebrow,
  heading,
  lead,
  bodyHtml,
  extraHead = "",
  bodyClass = "",
  afterMain = "",
  scriptsExtra = "",
}) {
  const prefix = assetPrefix(depth);
  const canonical = `https://cursor.lorapok.tech${canonicalPath}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="ccm-build-id" content="${ASSET_V}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <!-- seo:begin -->
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="https://cursor.lorapok.tech/assets/marketing/og-social-card.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <!-- seo:end -->
  <link rel="icon" href="${prefix}assets/logo.svg?v=${ASSET_V}" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin />
  <meta name="google-adsense-account" content="ca-pub-3756651399602872" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3756651399602872" crossorigin="anonymous"></script>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${prefix}styles.css?v=${ASSET_V}" />
  <link rel="stylesheet" href="${prefix}public-pages.css?v=${ASSET_V}" />
  <link rel="stylesheet" href="${prefix}larvae-loader.css?v=${ASSET_V}" />
  <link rel="stylesheet" href="${prefix}ccm-floating-assistant.css?v=${ASSET_V}" />
  <link rel="stylesheet" href="${prefix}consent.css?v=${ASSET_V}" />
  ${extraHead}
</head>
<body class="public-page ${bodyClass}">
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <div class="site-ambient-mesh" aria-hidden="true"></div>
  <header class="site-header">
    <div class="header-bar container">
      <a class="brand" href="${prefix}">
        <span class="brand-logo">
          <img src="${prefix}assets/logo.svg?v=${ASSET_V}" alt="Cursor Curse Monitor" width="48" height="48" />
        </span>
        <span class="brand-text">
          <span class="brand-name">Cursor Curse Monitor</span>
          <span class="brand-by">by Lorapok Labs</span>
        </span>
      </a>
      <div class="header-actions">
        <button type="button" class="nav-toggle" id="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links">
          <span class="nav-toggle-bar"></span>
          <span class="nav-toggle-bar"></span>
          <span class="nav-toggle-bar"></span>
        </button>
      </div>
    </div>
    <div class="header-nav-shell">
      <nav class="header-nav container nav-links" id="nav-links" aria-label="Primary">
${renderNav(active, depth)}
      </nav>
    </div>
  </header>

  <section class="page-hero">
    <div class="container">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(heading)}</h1>
      <p class="lead">${escapeHtml(lead)}</p>
    </div>
  </section>

  <div class="prose-wrap container public-page-body">
    <main class="prose" id="main-content" tabindex="-1">
${bodyHtml}
    </main>
  </div>
  ${afterMain}

  <footer class="site-footer">
    <div class="container footer-inner">
      <nav class="footer-platforms" aria-label="Platform availability">
        <a data-href-ovsx href="https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok" target="_blank" rel="noopener" title="Open VSX">Open VSX</a>
        <span aria-hidden="true">·</span>
        <a data-href-vscode href="https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok" target="_blank" rel="noopener" title="VS Code Marketplace">VS Code</a>
        <span aria-hidden="true">·</span>
        <a data-href-firefox href="https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor/" target="_blank" rel="noopener" title="Firefox Add-ons">Firefox</a>
        <span aria-hidden="true">·</span>
        <a data-href-chrome-zip href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest" target="_blank" rel="noopener" title="Chrome direct zip">Chrome zip</a>
        <span aria-hidden="true">·</span>
        <a data-href-release href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases" target="_blank" rel="noopener" title="GitHub Releases">GitHub</a>
      </nav>
      <nav class="footer-social" data-footer-social="minimal" aria-label="Lorapok Labs social links"></nav>
      <p data-footer-contribute class="footer-contribute">Open source · <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">CONTRIBUTING</a> · <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22" target="_blank" rel="noopener">Good first issues</a> · <a href="https://github.com/users/Maijied/projects/4" target="_blank" rel="noopener">Project #4</a></p>
      <p>GPL-3.0 © Lorapok Labs · <a href="${prefix}">Home</a> · <a href="${prefix}wiki/">Wiki</a> · <a href="${prefix}releases.html">Releases</a> · <a href="${prefix}community.html">Community</a> · <a href="${prefix}docs/">Docs</a> · <a href="${prefix}privacy.html">Privacy</a> · <a href="${prefix}terms.html">Terms</a></p>
      <p><a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok" target="_blank" rel="noopener">GitHub</a> · Not affiliated with Cursor / Anysphere</p>
    </div>
  </footer>
  <script src="${prefix}cloudflare-beacon.js?v=${ASSET_V}" defer></script>
  <script src="${prefix}social-footer.js?v=${ASSET_V}" defer></script>
  <script src="${prefix}consent.js?v=${ASSET_V}" defer></script>
  <script src="${prefix}adsense.js?v=${ASSET_V}" defer></script>
  <script src="${prefix}analytics.js?v=${ASSET_V}" defer></script>
  <script src="${prefix}site.js?v=${ASSET_V}" defer></script>
  <script src="${prefix}ccm-floating-assistant.js?v=${ASSET_V}" defer></script>
  ${scriptsExtra}
</body>
</html>
`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function firstParagraph(md) {
  const lines = String(md).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith("#")) continue;
    if (line.startsWith("|") || line.startsWith("-") || line.startsWith("*")) continue;
    return line.replace(/\*\*/g, "").slice(0, 160);
  }
  return "Cursor Curse Monitor documentation by Lorapok Labs.";
}

function generateWiki() {
  const outDir = join(website, "wiki");
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const files = readdirSync(wikiSrc).filter((f) => f.endsWith(".md")).sort();
  const indexLinks = [];

  for (const file of files) {
    const stem = basename(file, ".md");
    const md = readFileSync(join(wikiSrc, file), "utf8");
    const titleMatch = md.match(/^#\s+(.+)$/m);
    const pageTitle = titleMatch ? titleMatch[1].trim() : stem;
    const body = wikiMarkdownToHtml(md, {
      linkMapper: (href) => mapWikiHref(href, { fromFile: `wiki/${stem}` }),
    });
    const isHome = stem === "Home";
    const outName = isHome ? "index.html" : `${stem}.html`;
    const canonicalPath = isHome ? "/wiki/" : `/wiki/${stem}.html`;
    const html = pageShell({
      title: `${pageTitle} — Wiki · Cursor Curse Monitor`,
      description: firstParagraph(md),
      canonicalPath,
      active: "wiki",
      depth: 1,
      eyebrow: "Public wiki",
      heading: pageTitle,
      lead: "Canonical source: docs/wiki in the repository (mirrored to GitHub Wiki).",
      bodyHtml: `      <nav class="wiki-toc" aria-label="Wiki pages">\n        <a href="./">Home</a>${files
        .filter((f) => basename(f, ".md") !== "Home")
        .map((f) => {
          const s = basename(f, ".md");
          const cur = s === stem ? ' aria-current="page"' : "";
          return `\n        <a href="${s}.html"${cur}>${s.replace(/-/g, " ")}</a>`;
        })
        .join("")}\n      </nav>\n${body}`,
    });
    writeFileSync(join(outDir, outName), html);
    if (!isHome) {
      indexLinks.push(`<li><a href="${stem}.html">${escapeHtml(pageTitle)}</a></li>`);
    }
    // Also emit Home.html alias for wiki-style links
    if (isHome) {
      writeFileSync(join(outDir, "Home.html"), html.replace(/rel="canonical" href="[^"]+"/, 'rel="canonical" href="https://cursor.lorapok.tech/wiki/"'));
    }
  }

  console.log(`Wrote ${files.length} wiki page(s) → website/wiki/`);
  return indexLinks;
}

function generateDocsHub() {
  const outDir = join(website, "docs");
  mkdirSync(outDir, { recursive: true });
  const wikiFiles = readdirSync(wikiSrc)
    .filter((f) => f.endsWith(".md"))
    .map((f) => basename(f, ".md"))
    .sort();
  const wikiList = wikiFiles
    .map((stem) => {
      const href = stem === "Home" ? "../wiki/" : `../wiki/${stem}.html`;
      return `<li><a href="${href}">${stem === "Home" ? "Wiki home" : stem.replace(/-/g, " ")}</a></li>`;
    })
    .join("\n          ");

  const body = `      <p>Operator and contributor documentation for Cursor Curse Monitor. Mission Control remains the live CMS for notices and deploys; these pages are generated from the repo.</p>
      <h2>Start here</h2>
      <ul>
          <li><a href="../wiki/Installation.html">Installation</a></li>
          <li><a href="../wiki/Architecture.html">Architecture</a></li>
          <li><a href="../wiki/Deployment.html">Deployment</a></li>
          <li><a href="../wiki/AI-Agent-Commands.html">AI agent commands</a> (<code>Update?</code> / <code>next</code>)</li>
          <li><a href="../wiki/Admin-Panel.html">Mission Control / Admin Panel</a></li>
      </ul>
      <h2>Full wiki index</h2>
      <ul>
          ${wikiList}
      </ul>
      <h2>Also on this site</h2>
      <ul>
          <li><a href="../releases.html">Releases</a> — live from <code>site-data.json</code></li>
          <li><a href="../community.html">Community</a> — Project #4, issues, traffic</li>
          <li><a href="../#engineering">Behind the scenes</a> — monorepo &amp; procedure (WEB-08)</li>
          <li><a href="../engineering/history/">Engineering history</a> — long-form timeline (WEB-11)</li>
      </ul>`;

  const html = pageShell({
    title: "Docs — Cursor Curse Monitor by Lorapok",
    description: "Installation, architecture, Mission Control, and agent command docs for Cursor Curse Monitor.",
    canonicalPath: "/docs/",
    active: "docs",
    depth: 1,
    eyebrow: "Documentation",
    heading: "Docs hub",
    lead: "Guides mirrored from docs/wiki — Mission Control is the operator CMS.",
    bodyHtml: body,
  });
  writeFileSync(join(outDir, "index.html"), html);
  console.log("Wrote website/docs/index.html");
}

function generateReleases() {
  const body = `      <p>Release metadata is loaded from the latest <code>site-data.json</code> build (Mission Control sync). Download assets link to GitHub Releases and marketplaces.</p>
      <div id="public-releases" class="public-live-panel" data-public-page="releases" aria-live="polite">
        <p class="muted">Loading release data…</p>
      </div>`;
  const html = pageShell({
    title: "Releases — Cursor Curse Monitor by Lorapok",
    description: "Current version, download links, and release highlights for Cursor Curse Monitor.",
    canonicalPath: "/releases.html",
    active: "releases",
    depth: 0,
    eyebrow: "Releases",
    heading: "Version history",
    lead: "Live channels from Open VSX, VS Code Marketplace, Firefox AMO, and GitHub.",
    bodyHtml: body,
    scriptsExtra: `  <script src="./public-pages.js?v=${ASSET_V}" defer></script>\n`,
  });
  writeFileSync(join(website, "releases.html"), html);
  console.log("Wrote website/releases.html");
}

function generateCommunity() {
  const body = `      <p>Community pulse from <code>site-data.json</code> plus links to GitHub Project #4 and discussions. Approved Mission Control notices appear on the marketing home notice strip; this page summarizes public stats.</p>
      <div id="public-community" class="public-live-panel" data-public-page="community" aria-live="polite">
        <p class="muted">Loading community data…</p>
      </div>
      <h2>Contribute</h2>
      <ul>
        <li><a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">CONTRIBUTING.md</a></li>
        <li><a href="https://github.com/users/Maijied/projects/4" target="_blank" rel="noopener">Project #4 task board</a></li>
        <li><a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22" target="_blank" rel="noopener">Good first issues</a></li>
      </ul>`;
  const html = pageShell({
    title: "Community — Cursor Curse Monitor by Lorapok",
    description: "GitHub community stats, Project #4, and contributor links for Cursor Curse Monitor.",
    canonicalPath: "/community.html",
    active: "community",
    depth: 0,
    eyebrow: "Community",
    heading: "Join the build",
    lead: "Issues, discussions, and live traffic from the public GitHub project.",
    bodyHtml: body,
    scriptsExtra: `  <script src="./public-pages.js?v=${ASSET_V}" defer></script>\n`,
  });
  writeFileSync(join(website, "community.html"), html);
  console.log("Wrote website/community.html");
}

function generateEngineeringHistory() {
  const eras = [
    {
      id: "origin",
      era: "2026-08 · Origin",
      title: "IDE extension first",
      body: "Cursor Curse Monitor started as a VS Code / Cursor wrapper extension: local-first usage meters, budget caps, and Composer fallback — tokens never leave the machine. Early releases landed on Open VSX and the VS Code Marketplace under Lorapok Labs.",
      links: [
        { href: "../wiki/Installation.html", label: "Installation" },
        { href: "../releases.html", label: "Releases" },
      ],
    },
    {
      id: "browser",
      era: "Browser surface",
      title: "Firefox + Chrome add-on",
      body: "The browser extension reused shared quota logic from <code>@lorapok/cursor-monitor-shared</code>, shipping on Firefox AMO with a Chrome zip channel. Popup and options carry the same privacy-first model as the IDE host.",
      links: [
        { href: "https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor/", label: "Firefox AMO", external: true },
        { href: "../wiki/Ecosystem-Roadmap.html", label: "Ecosystem roadmap" },
      ],
    },
    {
      id: "mission-control",
      era: "Mission Control",
      title: "Operator CMS on Cloudflare",
      body: "Mission Control (admin SPA on Cloudflare Pages) became the ops surface: notices, mailbox, marketplace sync, settings hubs, and deploy controls. Firebase auth + RBAC gate the dashboard; Pages Functions own the API.",
      links: [
        { href: "../wiki/Admin-Panel.html", label: "Admin Panel wiki" },
        { href: "https://cursor-dev.lorapok.tech/", label: "Mission Control", external: true },
      ],
    },
    {
      id: "cicd",
      era: "CI / CD",
      title: "One workflow, many jobs",
      body: "A single <code>ci-cd.yml</code> pipeline covers resolve-version → tests → tag prep → marketplace publish → admin + marketing deploy → Discord notify and social gallery queue. Architecture wiki diagrams stay in sync with job names.",
      links: [
        { href: "../wiki/Architecture.html", label: "Architecture" },
        { href: "../wiki/Deployment.html", label: "Deployment" },
      ],
    },
    {
      id: "procedure",
      era: "Procedure + agents",
      title: "Tracked work, not chat dumps",
      body: "Non-trivial work opens a <code>procedure/</code> file and a GitHub issue on Project #4. Agents say <strong>Update?</strong> for status and <strong>next</strong> for the top queue item. Cred vault sync scripts keep secrets out of git and CI logs.",
      links: [
        { href: "../wiki/AI-Agent-Commands.html", label: "AI agent commands" },
        { href: "../wiki/GitHub-Project.html", label: "GitHub Project" },
        { href: "https://github.com/users/Maijied/projects/4", label: "Project #4", external: true },
      ],
    },
    {
      id: "public-site",
      era: "Public face",
      title: "Website, wiki, Chrysalis",
      body: "Marketing home gained live stats, expanded topology (WEB-07), behind-the-scenes (WEB-08), and multi-page wiki/releases/community/docs (WEB-09). Chrysalis (Larvae) is the floating product assistant brand across site and Mission Control.",
      links: [
        { href: "../wiki/Public-Website.html", label: "Public Website" },
        { href: "../wiki/Chrysalis.html", label: "Chrysalis" },
        { href: "../#engineering", label: "Behind the scenes" },
      ],
    },
    {
      id: "welcome",
      era: "Open source welcome",
      title: "Contributor paths everywhere",
      body: "WEB-10 put CONTRIBUTING, good-first issues, and Project #4 on marketing footers, hero/subscribe CTAs, IDE and browser footers, options, and Chrysalis — so newcomers can join without hunting.",
      links: [
        { href: "../community.html", label: "Community" },
        {
          href: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/CONTRIBUTING.md",
          label: "CONTRIBUTING.md",
          external: true,
        },
      ],
    },
    {
      id: "credits",
      era: "Credits",
      title: "Lorapok Labs",
      body: "Founded and maintained by <strong>Mohammad Maizied Hasan Majumder</strong> (Lorapok Labs). GPL-3.0. Not affiliated with Cursor / Anysphere. Community help welcome via Discord and GitHub.",
      links: [
        { href: "https://lorapok.tech", label: "lorapok.tech", external: true },
        { href: "https://discord.gg/bp42QAMC6", label: "Discord", external: true },
        { href: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok", label: "GitHub", external: true },
      ],
    },
  ];

  const toc = eras
    .map((e) => `        <a href="#${e.id}">${escapeHtml(e.title)}</a>`)
    .join("\n");

  const items = eras
    .map((e) => {
      const links = e.links
        .map((l) => {
          const rel = l.external ? ' target="_blank" rel="noopener"' : "";
          return `<a href="${l.href}"${rel}>${escapeHtml(l.label)}</a>`;
        })
        .join(" · ");
      return `      <article class="eng-history-item" id="${e.id}">
        <p class="eng-history-era">${escapeHtml(e.era)}</p>
        <h2>${escapeHtml(e.title)}</h2>
        <p>${e.body}</p>
        <p class="eng-history-links">${links}</p>
      </article>`;
    })
    .join("\n");

  const body = `      <p>Long-form behind-the-scenes arc for Cursor Curse Monitor — how the monorepo, Mission Control, CI/CD, procedure workflow, and public surfaces grew together. The home <a href="../#engineering">#engineering</a> section is the short version; this page is the timeline.</p>
      <nav class="wiki-toc eng-history-toc" aria-label="Timeline sections">
${toc}
      </nav>
      <div class="eng-history-timeline" role="list">
${items}
      </div>
      <p class="muted">Live deploy metadata: <a href="../releases.html">Releases</a> · operator docs: <a href="../docs/">Docs hub</a> · roadmap: <a href="../wiki/Ecosystem-Roadmap.html">Ecosystem Roadmap</a>.</p>`;

  const outDir = join(website, "engineering", "history");
  mkdirSync(outDir, { recursive: true });
  const html = pageShell({
    title: "Engineering history — Cursor Curse Monitor by Lorapok",
    description:
      "Behind-the-scenes timeline: monorepo, CI/CD, Mission Control, procedure workflow, releases, and Lorapok Labs credits.",
    canonicalPath: "/engineering/history/",
    active: "docs",
    depth: 2,
    eyebrow: "Behind the scenes",
    heading: "Engineering history",
    lead: "Sectioned milestones from IDE extension to Mission Control, public wiki, and contributor welcome.",
    bodyHtml: body,
    bodyClass: "eng-history-page",
  });
  writeFileSync(join(outDir, "index.html"), html);
  console.log("Wrote website/engineering/history/index.html");
}

generateWiki();
generateDocsHub();
generateReleases();
generateCommunity();
generateEngineeringHistory();
console.log("generate-public-pages.mjs: OK");
