# Plan: Website Final Polish — Animated Stats, AMO Markdown, Changelog Popup, PR

**Branch:** `feat/website-final-polish` (from `main`)  
**Primary focus:** Marketing site design at `cursor.lorapok.tech`  
**Repo:** `/home/maizied/cursor-usage-monitor`

---

## Goals

1. **Remove duplicate marketing images** — each PNG appears at most once on the page.
2. **Replace hero screenshot** (`hero-marketing.png`) with a **live animated stats dashboard** (downloads, visits, engagement, Open VSX split).
3. **Fix AMO public URL** → `https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor/`
4. **Rewrite AMO listing copy** using [Extension Workshop Markdown](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/#make-use-of-markdown) (bold, lists, links — not raw HTML).
5. **Browser extension “What’s New” popup** on first open after update (professional changelog card).
6. **Final PR** with README/docs polish across the repo.

---

## Phase 1 — Website design (highest priority)

### 1A. Hero: animated live stats (replaces `hero-marketing.png`)

**Remove:** `.hero-device` block with `hero-marketing.png` lightbox (`index.html` ~L184–194).

**Add:** `.hero-stats-dashboard` — a glass card grid wired to existing `site-data.json`:

| Meter | Data binding | Animation |
|-------|--------------|-----------|
| Total downloads | `downloads.displayTotal` | Count-up 0→N over ~1.2s |
| Website visits | `visitors.websiteVisits` | Count-up + radial/bar fill |
| Engagement | `visitors.totalEngagement` | Count-up |
| Open VSX canonical | `downloads.breakdown.openVsxCanonical` | Horizontal bar |
| Open VSX duplicate | `downloads.breakdown.openVsxDuplicate` | Stacked bar segment |
| Combined Open VSX | `downloads.openVsxCombined` | Pulsing accent ring |

**Reuse existing primitives:**
- `.hero-panel.glass`, `.stat-row`, `.meter`, `.meter-fill` (`styles.css` L694–743)
- KPI logic already in `site.js` L46–71

**New files:**
- `website/stats-dashboard.js` — `animateValue()`, `renderHeroStats(data)`, `prefers-reduced-motion` guard
- `website/stats-dashboard.css` — ring gauges, staggered entrance (`@keyframes meter-rise`, `count-pop`)

**Keep:** Demo usage panel below stats OR merge into one unified dashboard (recommended: single card with “Live community stats” header + “Your session” sub-section with static demo quota rows).

### 1B. Deduplicate images across sections

**Rule:** Each file under `website/assets/marketing/` used **once** in `index.html`.

| Image | Keep in | Remove from |
|-------|---------|---------------|
| `showcase-dashboard.png` | Ecosystem IDE tab only | Features card, Gallery |
| `showcase-privacy.png` | Privacy section only | Features card, Gallery |
| `showcase-browser-ext.png` | Ecosystem browser tab | Gallery |
| `showcase-admin.png` | Ecosystem admin tab | Gallery |
| `showcase-budget.png` | Features card (budget) | Gallery |
| `showcase-fallback.png` | Features card (fallback) | Gallery |
| `showcase-install.png` | Install section visual | Gallery |
| `showcase-oss.png` | Gallery only | — |
| `founder-profile.png` | Author section only | Gallery |
| `hero-marketing.png` | **Remove entirely** from page | Hero + Gallery |
| `og-social-card.png` | Gallery OR meta only | Pick one visible use |

**Features section redesign (no duplicate PNGs):**
- Replace image buttons on dashboard/privacy cards with **inline SVG illustrations** already in `website/assets/` (`monitor-dashboard.svg`, `security-shield.svg`, etc.) at larger size with subtle CSS float animation.
- Keep screenshot cards only for budget + fallback (unique assets).

**Gallery section:**
- Shrink to **unique-only** masonry (~5–6 items: OSS, budget, fallback, install, og-social, optional browser-ext if removed from ecosystem duplicate).
- Or convert gallery to **“Live metrics”** section with no PNG tiles — stats dashboard + ecosystem tabs carry visuals.

### 1C. Relocate / simplify bottom KPI strip

- **Move** animated stats to hero (above the fold).
- **Demote** `#kpi-strip` at `#marketplace-links` to a compact inline row OR remove if hero dashboard covers same data.
- Keep Open VSX breakdown bar only if not fully represented in hero.

### 1D. CSS polish (frontend-design direction)

**Aesthetic:** Dark glass, blue→violet gradients, DM Sans + JetBrains Mono (existing).

| Enhancement | Where |
|-------------|-------|
| Staggered card entrance on hero stats | `stats-dashboard.css` |
| Subtle ambient pulse on live dot | `.panel-live-dot` |
| Section spacing rhythm | `.section` padding consistency |
| Gallery → “Snapshots” eyebrow if kept | `index.html` copy |
| `prefers-reduced-motion` | disable count-up / pulse |

**Do not:** Re-introduce AI-generated duplicate screenshots.

---

## Phase 2 — AMO link + Markdown listing

### 2A. Canonical AMO URL constant

**Single source of truth** in `packages/shared/src/platformAvailability.ts`:

```ts
firefox: {
  url: "https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor/",
}
```

**Propagate to (~15 files):**
- `scripts/generate-site-data.mjs`
- `website/site.js` fallback
- `website/seo.yml` → regenerate `seo.json`, `sitemap.xml`
- `website/index.html` JSON-LD
- `README.md`, `DEPLOYMENT.md`, `MARKETPLACE_PUBLISHING.md`
- `docs/wiki/Home.md`, `docs/wiki/Installation.md`
- `website/admin/src/components/pages/Docs.tsx`
- `browser-extension/scripts/verify-amo-status.mjs` → default slug `cursor-curse-monitor`
- `browser-extension/scripts/sync-amo-listing.mjs` → fix slug `cursor-curse-monitor` (not `by-lorapo`)

Run `npm run site:data && npm run site:seo` after URL change.

### 2B. AMO description → Markdown

**File:** `browser-extension/amo/amo-metadata.base.json`

Convert `description.en-US` from HTML to Markdown per Extension Workshop:

```markdown
**Cursor Curse Monitor by Lorapok** shows your Cursor AI usage, budget cap, billing cycle reset, and spend-over-time trend — right in your browser toolbar.

- Animated budget gauge with threshold warnings
- Auto & API usage meters
- Local security scanner on token paste
- Connect via cursor.com/dashboard or paste a token manually
- Tokens stay on your device — never sent to Lorapok servers

**Also available on:** [Open VSX](…), [VS Code Marketplace](…), [GitHub Releases](…), [Product website](…).

A product of [Lorapok Labs](https://lorapok.tech). Built for [Cursor](https://cursor.com) users.
```

**Also update:**
- `version.release_notes` in generator — strip to Markdown bullets from `CHANGELOG.md` (already plain text; ensure no HTML)
- Add `formatAlsoAvailableMarkdown()` helper in `packages/shared/src/platformAvailability.ts` (optional, keeps AMO + README in sync)

**Validator:** Run `node browser-extension/scripts/validate-amo-metadata.mjs` after edit.

---

## Phase 3 — Browser “What’s New” changelog popup

### 3A. Build-time release notes injection

**Extend** `browser-extension/vite.config.ts`:

```ts
define: {
  __EXTENSION_VERSION__: JSON.stringify(extensionVersion),
  __RELEASE_NOTES__: JSON.stringify(extractReleaseNotes(changelog, extensionVersion)),
}
```

Share `extractReleaseNotes()` by extracting to `browser-extension/scripts/lib-changelog.mjs` (imported by both `generate-amo-metadata.mjs` and Vite config).

### 3B. Storage

**File:** `browser-extension/src/lib/storage.ts`

Add to `ExtensionSettings`:
```ts
lastSeenVersion: string | null;  // default null
```

### 3C. UI component

**New:** `browser-extension/src/components/WhatsNewCard.tsx`

- Modal-style card at top of popup (above connect card / dashboard)
- Header: “What’s new in v{version}”
- Body: Markdown-lite rendering (bold `**`, bullets `-`, links) — simple regex parser or split lines
- Footer: **Got it** → `updateSettings({ lastSeenVersion: __EXTENSION_VERSION__ })`
- Optional: “View full changelog” → `cursor.lorapok.tech` or GitHub releases

**Styles:** `popup/styles.css` — match existing glass/dark theme; reuse `SecurityAlertModal` overlay pattern if present.

### 3D. Hook in popup

**File:** `browser-extension/src/popup/App.tsx`

```tsx
const [showWhatsNew, setShowWhatsNew] = useState(false);
useEffect(() => {
  getSettings().then(s => {
    if (s.lastSeenVersion !== __EXTENSION_VERSION__) setShowWhatsNew(true);
  });
}, []);
```

Show on **every version bump**, not only first install (standard “what’s new” behavior).

### 3E. Tests

- `browser-extension/tests/test-whats-new.js` — component renders, dismiss sets `lastSeenVersion`
- Update `test-footer.js` if needed

---

## Phase 4 — README & docs final polish

| File | Changes |
|------|---------|
| `README.md` | Fix AMO link; add “What’s New” mention; screenshot points to live stats site |
| `CHANGELOG.md` | Add `## Unreleased` entry for this work |
| `MARKETPLACE_PUBLISHING.md` | AMO slug `cursor-curse-monitor`; Markdown listing note |
| `DEPLOYMENT.md` | AMO URL table |
| `docs/wiki/*.md` | AMO links |
| `website/admin/README.md` | Infra deploy note if missing |
| `loragent/skills/loragent-website-design/SKILL.md` | Document animated-stats pattern (optional follow-up) |

**Badge:** Add Firefox AMO badge with correct slug if available.

---

## Phase 5 — PR & deploy

### Branch & PR

```bash
git checkout -b feat/website-final-polish
# ... implement ...
git push -u origin feat/website-final-polish
gh pr create --title "feat: animated live stats hero, AMO markdown, what's new popup" \
  --body "## Summary
- Replace duplicate hero/gallery images with animated live stats dashboard
- Fix AMO public URL to cursor-curse-monitor
- AMO listing description in Extension Workshop Markdown
- Browser extension What's New changelog popup on version bump
- README/docs polish

## Test plan
- [ ] Open website locally — hero stats animate from site-data.json
- [ ] No duplicate PNGs in index.html (grep each filename)
- [ ] AMO metadata validates
- [ ] Browser ext popup shows What's New once per version
- [ ] npm run browser-ext:test && npm run test:downloads
- [ ] Mission Control Infra deploy → cursor.lorapok.tech"
```

### Post-merge deploy

Mission Control → **Infra** → ✅ Marketing site (per `loragent-unified-deployment` skill).

AMO re-publish only if listing description changed (Mission Control → Deploy → Firefox AMO).

---

## Critical files to modify

### Website (design focus)
- `website/index.html` — hero stats HTML, dedupe gallery/features
- `website/styles.css` — hero stats, dedupe layout tweaks
- `website/site.js` — wire hero stats + remove duplicate KPI if merged
- `website/stats-dashboard.js` *(new)*
- `website/stats-dashboard.css` *(new)*

### AMO & shared
- `packages/shared/src/platformAvailability.ts`
- `browser-extension/amo/amo-metadata.base.json`
- `browser-extension/scripts/generate-amo-metadata.mjs`
- `browser-extension/scripts/sync-amo-listing.mjs`
- `browser-extension/scripts/verify-amo-status.mjs`
- `scripts/generate-site-data.mjs`
- `website/seo.yml`

### Browser extension popup
- `browser-extension/vite.config.ts`
- `browser-extension/src/lib/storage.ts`
- `browser-extension/src/components/WhatsNewCard.tsx` *(new)*
- `browser-extension/src/popup/App.tsx`
- `browser-extension/src/popup/styles.css`

### Docs
- `README.md`, `CHANGELOG.md`, `MARKETPLACE_PUBLISHING.md`, `DEPLOYMENT.md`, `docs/wiki/*`

---

## Verification checklist

1. **No duplicate images:** `rg -o 'assets/marketing/[^"]+' website/index.html | sort | uniq -d` → empty
2. **AMO URL:** `rg cursor-curse-monitor-by-lorapok` → zero hits for public AMO links (extension ID `@lorapok.tech` unchanged)
3. **Hero stats:** Load `website/index.html` via local server; numbers animate; respects `prefers-reduced-motion`
4. **site-data:** `npm run site:data` — `browserExtension.firefox.url` uses new slug
5. **AMO:** `node browser-extension/scripts/generate-amo-metadata.mjs && node browser-extension/scripts/validate-amo-metadata.mjs`
6. **Browser ext:** Build popup; bump version in storage; open popup → What's New shows; dismiss → hidden on reopen
7. **Tests:** `npm run browser-ext:test`, `node packages/shared/src/platformAvailability.test.mjs`
8. **SEO:** `npm run site:seo:validate`
9. **Visual:** Desktop + mobile screenshot of hero stats section
10. **PR CI:** GitHub Actions green on feature branch

---

## Implementation order (recommended)

1. AMO URL constant + regenerate site-data/seo *(quick win, unblocks links)*
2. Hero animated stats dashboard *(main design deliverable)*
3. Deduplicate gallery/features/ecosystem images
4. AMO Markdown description + script slug fixes
5. What's New popup (browser extension)
6. README/docs polish
7. Open PR → review → merge → Infra deploy

**Estimated scope:** ~12–18 files changed, 2 new JS/CSS modules, 1 new React component.
