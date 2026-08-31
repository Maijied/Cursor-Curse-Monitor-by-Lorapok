# PR #104 — in-app feedback, testmail, cred-vault, KV scatter

**Procedure ID:** `e665770d`  
**Status:** in_progress (merge-ready, awaiting approval)  
**Created:** 2026-09-01  
**Plan:** [plan/b7e2f4a9_multi-issue-fix-plan.md](../plan/b7e2f4a9_multi-issue-fix-plan.md)  
**Issue:** _Create with `gh issue create` or `node scripts/procedure-init.mjs` on next task_  
**Branch:** `feat/feedback-testmail-cred-vault`  
**PR:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/104

---

## Objective

Ship in-app feedback (IDE + browser), testmail subscribe probes, cred-vault governance, Resend mail fallback, scatter-gather KV writes, and CodeRabbit triage rules. Get PR #104 merge-ready.

---

## Progress

- [x] Plan context from [b7e2f4a9](../plan/b7e2f4a9_multi-issue-fix-plan.md)
- [x] Feedback API + Discord notify + IDE/browser UI
- [x] Cred-vault rule + testmail scripts
- [x] Resend fallback order fix + FeedbackModal `try/finally`
- [x] Scatter-gather KV (`kv-scatter.js`)
- [x] CodeRabbit triage rule
- [x] Procedure governance rule + scripts + merge workflow
- [x] CodeRabbit review threads triaged (5 resolved on PR)
- [ ] PR merged (blocked: branch protection / approval)
- [ ] Post-merge verification (Tier C)

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-01 | Scatter-gather KV vs Durable Objects | Low-volume endpoints; 1 put/record avoids blob RMW |
| 2026-09-01 | Defer rate limiting on feedback | No existing binding; subscribe has same gap |
| 2026-09-01 | Defer dialog focus trap | Minor a11y; popup usable without it |
| 2026-09-01 | Fix `setup-resend-secret` probe check | Fails fast when token probe fails |

---

## CodeRabbit triage (PR #104)

| Thread | Action | Notes |
|--------|--------|-------|
| `FeedbackModal.tsx` focus | Dismiss | Minor a11y defer |
| `feedback-submit.js` Discord timeout | Dismiss | Scatter KV landed; optional follow-up |
| `feedback.ts` rate limiting | Dismiss | Out of scope; no binding yet |
| `testmail.mjs` manual redirects | Defer | E2E script polish |
| `setup-resend-secret.mjs` probe | **Fix** | `!probe?.ok` guard added |

---

## Blockers

- **Merge gate:** `mergeStateStatus: BLOCKED` — requires human approval (not a CI failure).
- **Production KV quota:** Workers Free daily write limit may still block subscribe/feedback until reset.
- **Resend:** `RESEND_API_KEY` must be in cred vault for arbitrary-address mail.

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | `npm test` (root) | **pass** (2026-09-01) |
| A | `npm run build -w @lorapok/cursor-monitor-shared` | **pass** |
| A | `npm run browser-ext:test && npm run browser-ext:build` | **pass** |
| A | `cd website/admin && npm test` | **pass** (112 tests) |
| B | IDE extension package | CI: Build & Validate pass |
| B | Browser extension | CI: Browser Extension CI pass |
| B | Admin API (feedback, subscribe, kv-scatter) | vitest pass locally |
| B | Mail Resend fallback | `mail.js` order fixed |
| C | `POST /api/feedback` prod | After merge + deploy |
| C | `npm run mail:testmail` | After KV quota reset + Resend in vault |

**Merge-ready when:** CI green + review threads triaged + user approves merge.

---

## Post-merge checklist

- [ ] Merge PR #104
- [ ] Deploy admin (`npm run admin:deploy:fast` or CI deploy-infra)
- [ ] Verify feedback → Discord (`discordDelivered: true`)
- [ ] Sync Resend: `node website/admin/scripts/setup-resend-secret.mjs`
- [ ] Run testmail probe when KV quota allows
- [ ] CI generates `procedure/pr-104_*_merged.md` via workflow

---

## Retrospective

_Filled automatically on merge by `.github/workflows/procedure-on-merge.yml`._
