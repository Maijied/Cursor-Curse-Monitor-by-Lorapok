# Chrysalis — floating AI assistant

**Last updated:** 2026-09-05  
**Status:** in progress (website scaffold)  
**Task IDs:** CHRYS-01–05, WEB-06, ECO-03, ECO-06

---

## What Chrysalis is

**Chrysalis** is the Lorapok animated floating AI assistant for the Cursor Curse Monitor ecosystem. It helps users and operators understand the product, usage limits, and Mission Control workflows — with **strict privacy boundaries** per surface.

The Larvae mascot animates the floating panel; the intelligence layer learns from **public product context** and **user-provided API keys** (never Lorapok-shipped secrets on client surfaces).

---

## Surfaces

| Surface | Chrysalis role | API key source |
|---------|----------------|----------------|
| **Marketing website** | Product Q&A, stats, roadmap links | Static `site-data.json` + optional user BYOK later |
| **Mission Control (admin)** | Operator guide, deploy/mail/settings help | Operator key in **cred vault** (Antigravity or other) via server proxy |
| **IDE extension** | Usage warnings, limit suggestions | **User's** API key from settings (BYOK) |
| **Browser extension** | Budget alerts, paste-guard context | **User's** API key from options (BYOK) |
| **OS tray app** (planned) | Notifications + quick ask | User BYOK |

---

## Privacy tiers (CHRYS-03)

1. **Public** — wiki, `site-data.json`, marketplace stats only. No admin KV, no subscriber PII, no vault material.
2. **Operator (admin)** — full system map under RBAC. Chrysalis never echoes secrets into chat logs or client bundles.
3. **User (extensions/web BYOK)** — learns from local usage state + public docs; key stays on device; passive sync with user consent only.

Fail closed: if ACL or context bundle is ambiguous, Chrysalis refuses rather than over-share.

---

## AI provider (CHRYS-02)

- **Admin:** Antigravity or other model — API key stored in cred vault (`cred get cursor …`), proxied through Pages Functions.
- **User surfaces:** User supplies their own provider key in extension options / website settings (CHRYS-04).
- Lorapok does **not** embed production API keys in git, `wrangler.toml`, or shipped VSIX/browser builds.

---

## System learning (CHRYS-05)

Chrysalis builds suggestions from:

- `docs/wiki/*`, `site-data.json`, `CHANGELOG.md`
- Live usage / quota state (extension + browser)
- Mission Control notices and deploy status (admin only)

Outputs: usage warnings, budget reminders, deploy checklist hints, links to relevant wiki pages.

Pairs with [AI Agent Commands](AI-Agent-Commands) (ECO-10) — no secrets or full chat logs in procedure files.

---

## Implementation

| Artifact | Path |
|----------|------|
| Website floating panel (scaffold) | `website/ccm-floating-assistant.js` |
| Shared confirm helper | `packages/shared/src/confirmAction.ts` |
| Product context (admin mail templates) | `website/admin/functions/api/_shared/product-context.embedded.json` |

Rename and animation polish: **CHRYS-01**. Full AI chat: **CHRYS-02** onward.

---

## Related

- [Ecosystem Roadmap](Ecosystem-Roadmap)
- [Admin Panel](Admin-Panel)
- [Architecture](Architecture)
