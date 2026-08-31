# Multi-issue fix & follow-up plan

**Status:** PR #102 merged · PR #103 open  
**Branch:** `chore/pr-102-followups` → [PR #103](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/103)  
**Last updated:** 2026-08-31

---

## 1. Completed (merged via PR #102)

| Area | Change | Verify |
|------|--------|--------|
| Package version | `generate-site-data.mjs` / SEO use resolved `version` for `packageVersion`; admin `resolvePackageVersion` ignores `0.0.0` placeholder | Mission Control Overview shows real version |
| Architecture | Removed legacy STEPS list; Mermaid CSS opacity-only (no `transform` on nodes) | Admin Architecture tabs render diagrams |
| API Explorer | Removed auto-run on page load; idle badge shows "Not tested" | Open page → no requests until Run |
| Sidebar | Brand header + collapsible footer | Collapse/expand works |
| Marketing site | Hero overlap + subscribe modal guards in `site.js` / CSS | Hero animation not over cards; subscribe works |
| Subscribe mail | `subscribe.ts` returns 502 when welcome email fails; surfaces `mailWarning` | Failed send shows error to user |
| CI noise | `site-data.js` local fallback; `SITE_DATA_FILE` in admin-ci | No `resolveProductContext` 403 spam in logs |

---

## 2. In PR #103 (automated follow-ups)

| Item | Files | Acceptance |
|------|-------|------------|
| Vitest site-data path | `website/admin/src/setupTests.ts` | Local `npm test` uses `website/site-data.json`, no remote fetch |
| packageVersion tests | `website/admin/src/lib/site-data.test.ts` | `0.0.0` → falls back to `version` |
| Subscribe API tests | `website/admin/src/__tests__/subscribe-api.test.ts` | Consent, mailbox entry, subscriber list |
| Dev probe parity | `website/admin/vite-dev-api.mjs` | `POST /api/subscribe` with `probe: true` matches production |

**CI gate:** Admin Panel CI green on PR #103.

---

## 3. Manual verification (post-merge #103)

Do these in production after deploy; check off when done.

### Mission Control (`https://cursor-dev.lorapok.tech`)

- [ ] **Overview** — Package Version matches live release (not `0.0.0`)
- [ ] **Architecture** — All Mermaid tabs render (no gray misaligned boxes)
- [ ] **API Explorer** — Idle on load; Run triggers probes only when clicked
- [ ] **Sidebar** — Brand block + footer collapse behave correctly

### Marketing site (`https://cursor.lorapok.tech`)

- [ ] **Hero** — Top-right animation does not overlap feature cards
- [ ] **Subscribe** — Inline + modal: valid email + consent → success or clear mail error
- [x] **site-data.json** — `packageVersion` matches `version` on live URL *(verified 2026-08-31: `1.0.65` / `1.0.65`)*

### Mail pipeline

- [ ] **Subscribe E2E** — New email → welcome in user inbox
- [ ] **Mailbox** — Outbound subscribe row in Mission Control Mailbox
- [ ] **Ops copy** — BCC/forward to ops inbox if configured (`MAIL_OPS_COPY`)
- [x] **Health** — `GET /api/health` → `mailConfigured: true` *(verified 2026-08-31: `cloudflare-relay`, relay bound)*
- [x] **Subscribe probe** — `POST /api/subscribe` with `probe: true` → 200 *(verified 2026-08-31)*

If mail fails: `node website/admin/scripts/repair-mail.mjs` (vault creds locally).

### Security

- [ ] **Vault passphrase** — Rotate if exposed in chat; re-sync with `npm run mail:sync-vault` in admin

---

## 4. Optional / backlog

| Item | Notes |
|------|-------|
| Delete stale branch | `fix/multi-issue-version-arch-mail-ui` after PR #103 merges |
| Review git stashes | `git stash list` — `pre-main-pull`, `pre-multifix-plan`, etc. |
| Workspace file modes | ~3.5k tracked files show `100644→100755` locally (no content diff). **Do not commit.** Reset with `git -c core.fileMode=false reset --hard HEAD` or fix mount `noexec` / umask. |
| Admin vitest locally | Some suites need `npm ci` + `npm run build -w @lorapok/cursor-monitor-shared` if `framer-motion` / shared resolve fails |
| Regenerate site artifacts | `npm run site:data && npm run site:seo` before release if marketplace numbers drift |

---

## 5. Execution order

```mermaid
flowchart TD
  A[PR #103 merge] --> B[Production deploy]
  B --> C[Manual checklist §3]
  C --> D{Mail OK?}
  D -->|yes| E[Close loop]
  D -->|no| F[repair-mail.mjs + vault sync]
  F --> C
```

---

## 6. Commands reference

```bash
# Local admin tests (from website/admin)
npm test

# Regenerate marketing data (repo root)
npm run site:data && npm run site:seo

# Fast admin deploy (preview)
npm run admin:deploy:fast

# Mail repair (needs Cloudflare + vault)
node website/admin/scripts/repair-mail.mjs
```
