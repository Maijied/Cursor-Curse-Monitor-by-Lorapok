# Ecosystem roadmap

**Last updated:** 2026-09-05  
**GitHub Project:** [Team Planning #4](https://github.com/users/Maijied/projects/4)  
**Master registry:** `plan/mission-control-master-tasks.md` (section **Ecosystem expansion**)

---

## Vision

Cursor Curse Monitor becomes a **full Lorapok ecosystem**: IDE extension, all major browsers, OS tray app, Mission Control admin, marketing site with **Chrysalis** (floating AI), push notifications, action validators, and a native **Cursor plugin** — unified branding and always up-to-date product context.

---

## Surfaces (current → planned)

| Surface | Status | Task IDs |
|---------|--------|----------|
| IDE extension (VS Code / Cursor wrappers) | **shipped** | — |
| Firefox + Chrome browser extension | **shipped** | BR-03–05, EXT-01 |
| Safari, Edge, Opera, Brave builds | **planned** | ECO-01 |
| Mission Control admin | **shipped** | AUTH-13, ANALYTICS-01, … |
| Marketing website | **shipped** | ECO-02, ECO-03 |
| OS tray app (Win/macOS/Linux) | **planned** | ECO-04 |
| Cursor native plugin | **planned** | ECO-05 |
| Floating AI — **Chrysalis** (all surfaces) | **in progress** | CHRYS-01–05, ECO-03, ECO-06 |
| Beta release pipeline | **broken / fix needed** | REL-01 |
| Admin global search + UX | **planned** | ADMIN-01, ADMIN-02 |
| Push notifications (browser + OS) | **planned** | ECO-07 |
| Action validator (destructive ops) | **in progress** | ECO-08 |
| Global loading animation (Larvae) | **partial** | ECO-09 |
| AI conversation hygiene / no junk data | **planned** | ECO-10 |

---

## Community & ops metrics

Snapshot (GitHub Insights, Sep 2026):

| Metric | Value |
|--------|-------|
| Git clones (14d) | 3,933 (352 unique) |
| Repo views (14d) | 1,984 (15 unique) |
| Open issues | 43 |
| CI avg job time | 43s · 5% failure rate |

Live copy: `site-data.json` → `githubCommunity` (refreshed via `npm run site:data`).

---

## Chrysalis (floating AI)

See **[Chrysalis](Chrysalis)** for full spec.

- **Website:** `ccm-floating-assistant.js` — product info from `site-data.json` (CHRYS-01 rename in progress)
- **Admin:** operator guide + Antigravity/vault-backed model (CHRYS-02, CHRYS-03)
- **Extensions / tray:** user BYOK; passive learn + usage warnings (CHRYS-04, CHRYS-05)
- **Privacy:** tiered context — admin secrets never on public site; user keys never leave device without opt-in

---

## Action validator pattern

Shared module: `packages/shared/src/confirmAction.ts`

```ts
await confirmAction({ title, message, severity: "destructive" });
```

Use before: deploy, delete, broadcast email, cred vault write, marketplace publish.

---

## Related wiki pages

- [Chrysalis](Chrysalis)
- [AI Agent Commands](AI-Agent-Commands)
- [GitHub Project & Issues](GitHub-Project)
- [Architecture](Architecture)
