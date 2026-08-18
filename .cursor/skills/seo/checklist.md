# SEO Audit Checklist

## Website (GitHub Pages)

- [ ] `index.html` has unique `<title>` and `<meta name="description">`
- [ ] `<link rel="canonical">` matches homepage URL
- [ ] Open Graph tags: og:title, og:description, og:url, og:image
- [ ] Twitter card meta present
- [ ] JSON-LD `SoftwareApplication` with current version
- [ ] `sitemap.xml` lists all public pages with `lastmod`
- [ ] `robots.txt` references sitemap URL
- [ ] `seo.json` generated and valid

## Marketplace links

- [ ] README Open VSX link uses **lorapok-labs** namespace only
- [ ] Website nav/CTA uses canonical Open VSX URL
- [ ] No links to duplicate `LorapokLabs` Open VSX listing
- [ ] VS Code Marketplace link uses `LorapokLabs.cursor-curse-monitor-by-lorapok`

## Version sync (discoverability)

- [ ] `site-data.json` syncStatus is `synced` (or document why not)
- [ ] GitHub release tag matches package.json
- [ ] Open VSX canonical version matches package.json
- [ ] VS Code Marketplace version matches package.json

## Extension metadata

- [ ] `package.json` keywords include: cursor, usage, lorapok, monitor
- [ ] `package.json` keywords include: browser extension, firefox, security
- [ ] `displayName` and `description` are clear for store search
- [ ] `homepage` points to GitHub Pages site
- [ ] `repository` URL is correct

## Browser extension

- [ ] Firefox AMO URL in `website/index.html` and `site-data.json` / `seo.json` marketplaces.firefox
- [ ] Chrome zip `downloadUrl` / `installUrl` in JSON-LD (`@graph` browser entry)
- [ ] AMO listing (`browser-extension/amo/amo-metadata.base.json`) mentions security scanner
- [ ] Website feature list includes security scanner + browser install CTAs
- [ ] `browser-extension` CI job passes build + tests

## CI

- [ ] `seo.yml` workflow passes
- [ ] Website deploy includes fresh site-data + SEO artifacts

## Optional reach

- [ ] Google Search Console property verified
- [ ] Sitemap submitted to Search Console
- [ ] Open VSX publisher profile complete
- [ ] GitHub repo topics set (cursor, vscode-extension, open-vsx)
