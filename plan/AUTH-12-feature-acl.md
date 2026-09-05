# AUTH-12 — Feature ACL v2 (UI action gates)

Extends AUTH-01 nav/route RBAC with **per-control** gating on mutating UI actions. Server handlers already use `requirePermission()` (AUTH-07); this doc tracks the client mirror.

## UI features → permission

| Feature | Permission | Pages / components |
|---------|------------|-------------------|
| Notice editor, enable/disable, delete | `notices.write` | `Notices.tsx` |
| Email all subscribers | `subscribers.write` | `Subscribers.tsx` |
| Mailbox compose, test send, testmail E2E | `mail.send` | `Mailbox.tsx` |
| Mail transport sync up | `deploy.infra` | `Mailbox.tsx`, `MailSetupChecklist.tsx` |
| Team invite, role change, remove | `team.manage` | `Team.tsx` |
| Cred vault CI guidance (write actions) | `secrets.manage` | `CredVaultConfigCard.tsx` |
| Release / deploy / rollback | `deploy.run` | `Deployments.tsx` |
| Settings integration saves | `integrations.write` / `settings.write` | Settings cards (existing) |
| API Explorer mutating probes | per `rbac-routes.js` | `ApiExplorer.tsx` |

## Code

| Layer | Path |
|-------|------|
| Permission constants | `src/lib/feature-permissions.ts` |
| API route → permission | `src/lib/api-permissions.ts` (`permissionForApiRoute`, `canProbeApiRoute`) |
| Read-only banner | `src/components/ui/ReadOnlyAclBanner.tsx` |
| Session check | `useAuthSession().hasPermission()` |

## Verify

```bash
cd website/admin
npm test -- --run src/__tests__/auth-12-feature-acl.test.ts
npm run auth:tier-d
```

Manual: sign in as **viewer** → Mailbox visible, Compose hidden; Deployments nav hidden; Settings write controls disabled.
