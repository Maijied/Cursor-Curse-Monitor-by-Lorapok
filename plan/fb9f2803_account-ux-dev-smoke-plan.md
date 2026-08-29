# Plan: Account UX, Dev Smoke Harness, Dashboard Polish, Feedback & Star CTAs

**Branch:** `feat/multi-cursor-accounts` (extend; do not merge MCP-guard work unless user asks)  
**Date:** 2026-08-29  
**Aesthetic direction:** **Scandinavian + functionalist** — warm dark surfaces, rounded cards, generous spacing, purposeful motion (150–250ms ease-out). Matches existing Lorapok dashboard tokens; no purple-on-white generic AI look.

---

## Goals (user request mapped)

| # | Request | Success criteria |
|---|---------|------------------|
| 1 | On install, show logged-in Cursor account | First-run welcome names the detected session email/label |
| 2 | Switch accounts in IDE + browser add-on | Switcher works; install state reflects active login |
| 3 | Dev-only local smoke before commit/push | One command builds, tests, opens Cursor/VS Code EH + Firefox + Chrome with unpacked add-on |
| 4 | Collapsible Local insights + Recent sessions | IDE dashboard sections expand/collapse; state persisted |
| 5 | Better animation/design | Julian + animation-principles; `prefers-reduced-motion` respected |
| 6 | Feedback option (IDE + add-on) | Clear “Send feedback” → GitHub Issues (prefilled template optional) |
| 7 | Professional GitHub star request | Dismissible, non-spammy star CTA with snooze |
| 8 | Autopilot after implementation | PR green, comments triaged, merge-ready |

---

## Current state (already on branch)

**Done (uncommitted):**
- Shared `cursorAccounts.ts` — multi-account model, migration, JWT email hint
- IDE: `accountStore.ts`, `accountCommands.ts`, dashboard switcher, commands in `package.json`
- Browser: `storage.ts` accounts array, popup/options switcher, token capture upserts account
- Tests: `test_cursor_accounts.js`, lifecycle saved-account test, `test-accounts.js`

**Gaps vs user ask:**
- Welcome toast does **not** show connected account
- No dev smoke orchestrator
- Local insights card is **flat** (no collapse)
- No feedback / star CTAs in product UI
- Duplicate `cursorMissingAddAccount` button in `dashboardView.ts` (~747–748)

---

## Phase 1 — Install & account visibility

### 1.1 IDE welcome (first install)

**Files:** `src/extension.ts`, optionally `src/accountStore.ts`

- On `hasShownWelcome`, before showing toast:
  - `readCachedAccountEmail()` + `listPublicAccounts(context)`
  - Build message:  
    `Connected as {email or "This Cursor session"}. Switch accounts anytime from the dashboard.`
  - If no DB/token:  
    `Sign in to Cursor, or add another account from the dashboard (+).`
- Keep existing actions (Open Dashboard, subscribe CTAs).
- Do **not** block activation on account resolution (async, fail-open).

### 1.2 Dashboard boot state

**Files:** `src/dashboardView.ts`, `src/usageMonitor.ts`

- Ensure first `snapshot` pushed to webview includes `accounts`, `activeAccountId`, `email` (already wired).
- Pre-fill `#subscribeEmail` from `snapshot.email` when subscribe modal opens (parity with welcome).

### 1.3 Browser first connection

**Files:** `browser-extension/src/popup/App.tsx`, `browser-extension/src/lib/storage.ts`, `service-worker.ts`

- After first successful `tokenCaptured` / `saveToken`, set `globalState`-equivalent: `hasSeenConnection: true` in `settings`.
- Popup header: when connected, show **“Signed in as {email}”** (already partial); on first connect, brief inline banner: “Account saved — switch anytime below.”
- Options: “Connected as …” at top of account list (already has active badge).

### 1.4 Account switching QA checklist

- IDE: system session ↔ saved token; remove saved; refresh meters
- Browser: 2+ saved accounts; Use/Remove in Options; popup dropdown
- Verify tokens never in snapshot JSON / logs / tests

---

## Phase 2 — Dev-only local smoke harness

**Principle:** Opt-in, **never runs in CI**, never in pre-commit (governance). Developer runs explicitly before push.

### 2.1 Script: `scripts/dev-smoke.mjs`

**Behavior:**
1. Guard: exit 0 with message if `CI=true` unless `CCM_DEV_SMOKE=1`
2. `npm run build -w @lorapok/cursor-monitor-shared`
3. `npm run compile` (IDE)
4. `npm run browser-ext:build`
5. Run **scoped** tests (not full suite optional flag `--quick` skips long tests):
   - `node --test tests/test_cursor_accounts.js tests/test_usage_monitor_lifecycle.test.js`
   - `npm run browser-ext:test`
6. Launch targets (Linux, user machine):

| Target | Command strategy |
|--------|------------------|
| **Cursor / VS Code** | Prefer `cursor` then `code` CLI: open workspace folder; print instruction to press **F5** (Extension Development Host). Optional: write `.vscode/tasks.json` + `preLaunchTask` compile watch. |
| **Firefox** | `npx web-ext run -s browser-extension/dist -t firefox --firefox-profile` **or** `about:debugging` instructions if profile locked. Use **temporary** profile for add-on dev (not Maizied profile — extension load only). |
| **Chrome** | `google-chrome` / `~/.local/bin/chrome-maizied` with `--load-extension=$(pwd)/browser-extension/dist` + `--no-first-run` (new window). **Do not** restart user's main Chrome without flag; document `CCM_DEV_CHROME=maizied` for signed-in cursor.com testing. |

7. Print summary URLs:
   - Extension Host: dashboard view id
   - Firefox popup: `moz-extension://…`
   - Chrome popup: `chrome-extension://…`

### 2.2 VS Code integration

**Files:** `.vscode/tasks.json` (new), `.vscode/launch.json` (extend)

```json
// tasks.json (sketch)
- "compile-watch" → npm run watch
- "dev-smoke" → node scripts/dev-smoke.mjs

// launch.json
- preLaunchTask: "compile" or compound with watch
- optional "Dev Smoke (attach)" documentation only
```

### 2.3 npm scripts (root `package.json`)

```json
"dev:smoke": "node scripts/dev-smoke.mjs",
"dev:smoke:quick": "CCM_DEV_SMOKE=1 node scripts/dev-smoke.mjs --quick",
"dev:browser": "npm run dev -w browser-extension"
```

### 2.4 Documentation

**Files:** `AGENTS.md` (short §), `README.md` Development section

- When to run: before commit/push of extension or add-on UI changes
- Env vars: `CCM_DEV_SMOKE`, `CCM_DEV_CHROME`, `FIREFOX_BIN`, `CHROME_BIN`
- Explicit: **not** part of CI or husky (`.husky/pre-commit` stays secretlint + governance only)

### 2.5 Optional opt-in pre-push (later, if user wants)

- `.husky/pre-push` only when `CCM_PRE_PUSH_SMOKE=1` in developer env — **default off**

---

## Phase 3 — Collapsible Local insights (IDE dashboard)

**Files:** `src/dashboardView.ts` only (browser has no local insights)

### 3.1 Structure

Split current card (~885–901) into two collapsible regions:

1. **Local insights** — today/cycle stats + active models  
2. **Recent sessions** — `#sessionList`

Use `<button class="section-collapse-header">` with `aria-expanded`, `aria-controls`, keyboard Enter/Space.

### 3.2 CSS (extend `:root` block ~234–247)

```css
.section-collapse-header { display:flex; justify-content:space-between; width:100%; ... }
.section-collapse-body { overflow:hidden; transition: max-height 220ms ease-out, opacity 180ms ease-out; }
.section-collapse-body[data-open="false"] { max-height:0; opacity:0; }
@media (prefers-reduced-motion: reduce) { transition: none; }
```

### 3.3 Persistence

- `vscode.getState()` / `setState()` in webview script for `localInsightsOpen`, `sessionsOpen` (default: insights **open**, sessions **closed** if >3 rows else open).

### 3.4 Animation (animation-principles)

- Toggle: 200ms ease-out on max-height/opacity
- Chevron rotate: transform only (GPU-friendly)
- No bounce; stagger N/A

### 3.5 Accessibility (accessibility-and-inclusive-visualization)

- Header button exposes expanded state to screen readers
- Session rows keep text labels (mode, recency, +/- lines) — not color-only
- Reduced motion: instant toggle

### 3.6 Bugfix

- Remove duplicate `cursorMissingAddAccount` button (~747–748)

---

## Phase 4 — Feedback & GitHub star CTAs

### 4.1 Shared links module

**Files:** `packages/shared/src/communityLinks.ts` (new), export from `index.ts`

```ts
export const GITHUB_REPO = "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok";
export const GITHUB_ISSUES_NEW = `${GITHUB_REPO}/issues/new?template=feedback.md`; // add template if missing
export const GITHUB_STAR = `${GITHUB_REPO}`;
export const FEEDBACK_MAILTO = "mailto:cursor.curse.help@lorapok.tech?subject=Cursor%20Curse%20Monitor%20feedback";
```

Reuse `PLATFORM_LINKS` for marketplace review links where appropriate (Open VSX / VS Code / AMO).

### 4.2 IDE dashboard — “Community” card upgrade

**Files:** `src/dashboardView.ts`

Below community download stats (~965–969), add:

- **Feedback:** “Report an issue or suggest a feature” → `GITHUB_ISSUES_NEW`
- **Star on GitHub:** primary ghost button; copy: “If this saved you quota anxiety, a star helps others find it.”
- Snooze star CTA 14 days via `globalState` key `starPromptSnoozeUntil` (mirror subscribe snooze pattern in `updateSubscription.ts` or small `engagementPrompts.ts`)

Professional tone — one card, no modal spam. Star prompt: max once per snooze window; dismiss = snooze.

### 4.3 Browser add-on

**Files:**
- `browser-extension/src/components/Footer.tsx` — add Feedback link
- `browser-extension/src/components/EngagementCard.tsx` (new, optional) — compact star + feedback row in popup (below usage, above footer)
- `browser-extension/src/options/OptionsApp.tsx` — About section links

Persist snooze in `settings.starPromptSnoozeUntil`.

### 4.4 GitHub issue template (optional, low risk)

**File:** `.github/ISSUE_TEMPLATE/feedback.md` — title, version, surface (IDE/Firefox/Chrome), steps

---

## Phase 5 — Design polish pass (Julian)

**Scope:** IDE dashboard webview + browser popup/options (touch only account switcher, collapsibles, engagement row).

| Area | Change |
|------|--------|
| Typography | Slightly tighter section labels; consistent 11px meta / 12px body |
| Spacing | `gap` on account-switcher and collapse headers; align with existing `--panel` cards |
| Account switcher | Subtle focus ring (`--accent-2`); min 44px touch on browser select |
| Loading | Existing loading state; add `aria-busy` on refresh |
| Dark mode | Already dark; ensure star/feedback links meet contrast on `--muted` |

**Do not** introduce new font CDN in VS Code webview (CSP) — stay system UI stack.

---

## Phase 6 — Tests & verification

### Automated

| Test | File |
|------|------|
| Account helpers | `tests/test_cursor_accounts.js` ✓ |
| Saved account refresh | `tests/test_usage_monitor_lifecycle.test.js` ✓ |
| Browser account wiring | `browser-extension/tests/test-accounts.js` ✓ |
| Collapse markup present | `tests/test_dashboard_collapse.js` (new, string asserts in `dashboardView.ts`) |
| Community links | `packages/shared/src/communityLinks.test.mjs` (new) |
| dev-smoke dry run | `scripts/dev-smoke.test.mjs` — `--dry-run` prints steps, no browser launch |

### Manual (dev-smoke)

1. `npm run dev:smoke`
2. **Cursor:** F5 → dashboard shows account in header + welcome on fresh profile
3. **Firefox/Chrome:** popup loads; switch account; options list
4. Collapse local insights / sessions; reload webview — state restored
5. Feedback opens GitHub issues; star opens repo; snooze works

### Full CI before push

```bash
npm test
npm run compile
npm run browser-ext:build
```

---

## Phase 7 — Autopilot (execution, post-implementation)

After code complete:

1. Commit on `feat/multi-cursor-accounts` (user must ask to commit/push)
2. Open PR to `main`
3. Run **autopilot** loop:
   - Fix merge conflicts if any
   - Triage Bugbot/review comments
   - Fix failing CI (version check, secretlint, governance, tests)
4. Report merge-ready status

---

## File change summary

| Path | Action |
|------|--------|
| `packages/shared/src/communityLinks.ts` | **Add** |
| `packages/shared/src/index.ts` | Export |
| `src/extension.ts` | Welcome account message |
| `src/dashboardView.ts` | Collapsibles, engagement CTAs, subscribe prefill, dedupe button |
| `src/engagementPrompts.ts` | **Add** (star snooze, optional) |
| `scripts/dev-smoke.mjs` | **Add** |
| `scripts/dev-smoke.test.mjs` | **Add** |
| `.vscode/tasks.json` | **Add** |
| `.vscode/launch.json` | preLaunchTask |
| `package.json` | `dev:smoke` scripts |
| `browser-extension/src/components/Footer.tsx` | Feedback link |
| `browser-extension/src/components/EngagementCard.tsx` | **Add** (optional) |
| `browser-extension/src/popup/App.tsx` | Engagement card |
| `browser-extension/src/options/OptionsApp.tsx` | Feedback/star in About |
| `browser-extension/src/popup/styles.css` | Collapse/engagement styles |
| `AGENTS.md` | Dev smoke section |
| `.github/ISSUE_TEMPLATE/feedback.md` | **Add** (optional) |
| `tests/test_dashboard_collapse.js` | **Add** |

**Out of scope (this plan):**
- Committing 15k skill dump
- MCP guard branch merge (unless user requests)
- Admin SPA / website marketing changes
- OAuth multi-login (only token/session switching as designed)

---

## Implementation order (recommended)

1. Fix duplicate button + welcome account message (quick wins)
2. Collapsible local insights/sessions + a11y
3. Shared community links + feedback/star CTAs (IDE then browser)
4. Dev smoke script + VS Code tasks + docs
5. Tests + full `npm test`
6. Manual dev-smoke on Maizied machine
7. Autopilot PR hygiene

**Estimated touch surface:** ~15 files, ~800–1200 LOC (mostly `dashboardView.ts` HTML/CSS/JS).

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Auto-launching Chrome closes user tabs | Use new window + `--load-extension` only; never kill existing Chrome; document Maizied profile flag |
| `web-ext run` flaky on Linux | Fallback: print `about:debugging` load steps |
| Webview CSP blocks external links | Use `vscode.env.openExternal` via postMessage for feedback/star |
| Star CTA feels spammy | Snooze + show only in About/Community, not modal |
| Pre-commit bloat | Keep smoke **out** of husky |

---

## Open questions for user (non-blocking defaults)

1. **Star CTA placement:** About card only (default) vs popup banner after 3rd successful refresh?
2. **dev-smoke Chrome:** Temporary window (default) vs attach to Maizied profile for cursor.com capture testing?
3. **Commit scope:** Single commit or split (accounts / UI / dev-smoke)?

Defaults above are assumed if user does not answer before implementation.
