# AUTH-01 — Admin RBAC permission matrix

Canonical reference for Mission Control role-based access control. Server: `website/admin/functions/api/_shared/rbac.js`. Client mirror: `website/admin/src/lib/rbac.ts`.

## Roles

| Role | Description |
|------|-------------|
| `master` | Full access — deploy, secrets, team, email provision |
| `admin` | Integrations read, mail send, notices, subscribers |
| `operator` | Mailbox/notices/subscribers only |
| `viewer` | Read-only dashboards, logs, settings |

Default for allowlisted emails without explicit KV assignment: **admin**. Master email env always **master**.

## Permission matrix

| Permission | master | admin | operator | viewer |
|------------|:------:|:-----:|:--------:|:------:|
| `settings.read` | ✓ | ✓ | — | ✓ |
| `settings.write` | ✓ | — | — | — |
| `integrations.read` | ✓ | ✓ | — | ✓ |
| `integrations.write` | ✓ | — | — | — |
| `mail.read` | ✓ | ✓ | ✓ | ✓ |
| `mail.send` | ✓ | ✓ | ✓ | — |
| `mail.provision` | ✓ | — | — | — |
| `team.manage` | ✓ | — | — | — |
| `secrets.manage` | ✓ | — | — | — |
| `deploy.run` | ✓ | — | — | — |
| `deploy.infra` | ✓ | — | — | — |
| `notices.write` | ✓ | ✓ | ✓ | — |
| `subscribers.write` | ✓ | ✓ | ✓ | — |
| `logs.read` | ✓ | ✓ | ✓ | ✓ |
| `profile.write` | ✓ | ✓ | ✓ | ✓ |

## Storage

| Key | Content |
|-----|---------|
| `admin-rbac:v1` (ADMIN_KV) | `{ "email@lorapok.tech": "admin", ... }` |
| `user-profile:v1:{email}` | PIN verifier hash/salt, display name override |

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/auth/me` | Current user role + permissions + profile summary |
| `PUT /api/auth/profile` | Display name, PIN verifier backup (`profile.write`) |
| `GET /api/auth/rbac` | Team snapshot — effective roles for allowlist (`team.manage`) |
| `PUT /api/auth/rbac` | Assign `admin` / `operator` / `viewer` (`team.manage`) |

## UI

- **Settings → Profile** — avatar, providers, role badge, PIN quick-unlock
- **PIN overlay** — shown on dashboard load when PIN enabled and session not unlocked

## Next (AUTH-06+)

- Wire `requirePermission()` on deploy, team, secrets routes — **done (AUTH-07)**
- Team page role assignment UI — **done (AUTH-08)**
- Audit log on RBAC / allowlist changes — **done (AUTH-09)** via `acl-audit.js` → unified Logs (`source=acl`)
