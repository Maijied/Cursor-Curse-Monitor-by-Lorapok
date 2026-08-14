# Admin Panel & Release — Manual Test Guide

**Version:** 0.5.6  
**Last updated:** 2026-08-14

Use this checklist before tagging a stable release or after significant admin panel changes.

---

## Prerequisites

| Item | Command / location |
|------|------------------|
| Node.js | 20+ (22 recommended for site scripts) |
| Repo root | `/mnt/NewVolume/Personal_Projects/cursor-usage-monitor` |
| Admin dev server | `cd website/admin && npm run dev` → http://localhost:5173 |
| Site data | `npm run site:data` (from repo root) |
| Optional GitHub token | `website/admin/.env` → `GITHUB_TOKEN=ghp_...` (avoids 403 on tags/releases) |

---

## 1. Automated smoke (run first)

From repo root:

```bash
npm run compile && npm test
cd website/admin && npm test && npm run build
npm run verify:marketplace
node scripts/validate-seo.mjs
```

**Pass criteria:** all tests green, admin build succeeds, marketplace verify exits 0 (or documents known drift).

---

## 2. Admin login & auth

| # | Step | Expected |
|---|------|----------|
| 2.1 | Open http://localhost:5173/login | Login page loads, no CSS `@import` warnings in terminal |
| 2.2 | Sign in with Google (authorized admin email) | Redirect to `/dashboard` |
| 2.3 | Sign out from sidebar | Returns to `/login` |
| 2.4 | Open `/dashboard` while logged out | Redirect to login |
| 2.5 | Sign in with non-admin email | Access denied message |

---

## 3. Scroll & UI stability

| # | Step | Expected |
|---|------|----------|
| 3.1 | On **Overview**, scroll main content up/down for 10s | No flicker, no jitter on glass cards or background |
| 3.2 | Navigate every sidebar route, scroll each page | Background stays fixed; only content scrolls |
| 3.3 | Resize window narrow → wide | Layout reflows without horizontal scroll bleed |
| 3.4 | **Settings** → toggle light/dark theme | Theme persists after refresh |

---

## 4. Overview (`/dashboard`)

| # | Step | Expected |
|---|------|----------|
| 4.1 | KPI cards | Version, downloads, sync status visible |
| 4.2 | Sync radar / drift alert | Shows if Open VSX ≠ package version |
| 4.3 | Download breakdown | Open VSX, VS Code, GitHub numbers load from `site-data.json` |
| 4.4 | Visitor stats panel | Loads (local cache or Firebase when deployed) |

---

## 5. Marketplace (`/dashboard/marketplace`)

| # | Step | Expected |
|---|------|----------|
| 5.1 | Canonical vs duplicate Open VSX rows | Versions and URLs match `site-data.json` |
| 5.2 | VS Code Marketplace row | Version and link correct |
| 5.3 | Sync status badge | `synced` / `ahead` / `behind` reflects reality |

---

## 6. Releases & Activity

| # | Step | Expected |
|---|------|----------|
| 6.1 | **Releases** page | GitHub releases list or graceful error with token hint |
| 6.2 | **Activity** page | Recent workflow runs or cached empty state |
| 6.3 | With `GITHUB_TOKEN` in `.env`, restart dev server | Live GitHub data instead of errors |

---

## 7. Deployments (`/dashboard/deployments`)

| # | Step | Expected |
|---|------|----------|
| 7.1 | Target tag dropdown | Shows tags (live or cached from `site-data.json`) |
| 7.2 | Rate-limited GitHub | Yellow warning, **not** red blocking error; form still usable |
| 7.3 | Manual tag field | Enter `v0.5.5`, select market + channel |
| 7.4 | Trigger deployment (staging only if cautious) | Success toast or clear API error; verify run in GitHub Actions |

---

## 8. Community, SEO, Settings, Team

| # | Step | Expected |
|---|------|----------|
| 8.1 | **Community** | Discussions/issues fallback UI |
| 8.2 | **SEO** | Keywords, links, schema preview from `seo.json` |
| 8.3 | **Settings** | Theme toggle, env hints |
| 8.4 | **Team Access** | Master admin shown; add/remove admin emails (Firestore) |

---

## 9. Extension smoke (0.5.6)

| # | Step | Expected |
|---|------|----------|
| 9.1 | `npm run package` | VSIX builds without errors |
| 9.2 | Install VSIX in Cursor/VS Code | Extension activates |
| 9.3 | Open usage dashboard sidebar | Version shows **0.5.6** |
| 9.4 | Trigger refresh | No duplicate refresh / mutex warnings in dev console |
| 9.5 | Large `state.vscdb` fixture | Token read succeeds (sqlite path, not full WASM load) |

---

## 10. Website & SEO artifacts

```bash
npm run site:data
node scripts/generate-seo.mjs
node scripts/validate-seo.mjs
```

| # | Check | Expected |
|---|-------|----------|
| 10.1 | `website/site-data.json` | `"version": "0.5.6"`, `github.tags` populated |
| 10.2 | `website/seo.json` | `softwareVersion` = 0.5.6 |
| 10.3 | Local website preview | Install commands reference 0.5.6 |

---

## 11. Publish stable 0.5.6 to marketplaces

### Option A — GitHub Actions (recommended)

1. Commit and push all changes to `main`.
2. **Actions → CI/CD → Run workflow**
3. Inputs:
   - **Publish Market:** `Both`
   - **Release Channel:** `Production`
   - **Version Bump Type:** `custom`
   - **Custom Version:** `0.5.6` (if not already bumped locally)
4. Wait for `deploy` + `website` jobs.
5. Verify:
   - [Open VSX lorapok-labs](https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok) → 0.5.6
   - [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok) → 0.5.6
   - GitHub Release `v0.5.6` with VSIX asset

### Option B — Tag push (if version already on main)

```bash
git tag v0.5.6
git push origin main
git push origin v0.5.6
```

### Option C — Local Open VSX only

```bash
export OVSX_PAT=...
npm run package
npm run publish:ovsx
npm run verify:marketplace
```

---

## 12. Admin panel production

**Live URL (after deploy):** `https://admin.lorapok.tech`  
**Staging:** `https://cursor-monitor-admin.pages.dev`

CI job `admin-deploy` publishes on push to `main` when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets are set.

### Production smoke

| # | Step | Expected |
|---|------|----------|
| 12.1 | `curl -s https://admin.lorapok.tech/api/health` | JSON with `firebaseProject`, `githubTokenConfigured` |
| 12.2 | `curl -s https://admin.lorapok.tech/site-data.json \| jq .version` | Current package version |
| 12.3 | Open `/login` → sign in | Redirect to `/dashboard` |
| 12.4 | Deep link `/dashboard/deployments` | SPA loads (not 404) |
| 12.5 | Team → add admin → sign in as them | Dashboard + API routes work (no 403) |
| 12.6 | Deployments → trigger beta deploy | GitHub Actions run starts |

### One-time setup checklist

- [ ] Cloudflare Pages project `cursor-monitor-admin`
- [ ] KV namespace `ADMIN_KV` bound in `wrangler.toml`
- [ ] Pages env: `GITHUB_TOKEN`, `ADMIN_MASTER_EMAIL`, `FIREBASE_PROJECT_ID`
- [ ] DNS CNAME `admin.lorapok.tech`
- [ ] Firebase authorized domain `admin.lorapok.tech`
- [ ] Firestore rules deployed (`firebase deploy --only firestore:rules`)
- [ ] GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

See [`DEPLOYMENT.md`](../DEPLOYMENT.md) § Admin Panel for details.

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Tester | | | ☐ Pass ☐ Fail |
| Notes | | | |

**Known acceptable warnings**

- Marketplace sync `ahead` until Open VSX publish completes
- GitHub `n/a` in site-data when API rate-limited without token
- Duplicate Open VSX `LorapokLabs` listing until Eclipse deprecation
