# INT-01 integrations hub finish

**Procedure ID:** `dc74f8cd`  
**Status:** done  
**Created:** 2026-09-17  
**Plan:** plan/mission-control-master-tasks.md  
**Issue:** [#219](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/219)  
**Branch:** `feat/int-01-integrations-hub-finish`  
**PR:** [#268](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/268) (merged)

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
- [x] Review triaged (none)
- [x] Merged
- [x] Post-merge verification (close #219; Settings.int01 vitest + Admin Panel CI green)

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
| A | `npx vitest run IntegrationsHubCard ConnectedServicesCard Settings.int01` | pass |
| A | `npx oxlint` on touched files | pass |
| B | Settings → Services hub panes (Configure / Open tab + Discord/Social/Mail) | pass via `Settings.int01.test.tsx` (Browser MCP auth blocked) |
| C | Production smoke | after deploy |
| CI | Admin Panel CI on #268 | pass |
| Merge | PR #268 → main; issue #219 closed | done |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
