# INT-01 integrations hub finish

**Procedure ID:** `dc74f8cd`  
**Status:** in_progress  
**Created:** 2026-09-17  
**Plan:** plan/mission-control-master-tasks.md  
**Issue:** [#219](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/219)  
**Branch:** `feat/int-01-integrations-hub-finish`  
**PR:** [#268](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/268)

---

## Objective

Finish INT-01: consolidate duplicate Services-tab status/directory surfaces into a tabbed Integrations hub that can configure mail, Discord, social, image AI, GitHub webhooks, and cred sync in-place.

---

## Progress

- [x] Plan approved (registry queue #1 / **next**)
- [x] Procedure + link issue #219
- [x] Implementation: hub panes + Settings/ConnectedServices dedupe
- [x] Tests: `IntegrationsHubCard.test.tsx`, `ConnectedServicesCard.test.tsx`; oxlint clean
- [x] PR opened (#268)
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification (close #219)

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-17 | Hub panes embed existing config cards | One surface without deleting dedicated Settings tabs (deep links / ACL) |
| 2026-09-17 | Slim Connected Services to runtime/auth | Avoid duplicate mail/Discord rows already in hub |
| 2026-09-17 | Drop Integration directory card | Redundant with hub pane strip + Configure/Open tab actions |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | `npx vitest run IntegrationsHubCard ConnectedServicesCard` | pass |
| A | `npx oxlint` on touched files | pass |
| B | Settings → Services hub panes | after PR |
| C | Production smoke | after merge |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
