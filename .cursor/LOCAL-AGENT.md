# Local agent onboarding (durable)

**Audience:** AI agents running on the maintainer's PC — not Cloud Agent VMs.

Read this once per session alongside [`AGENT_INIT.md`](../AGENT_INIT.md). For build/test/deploy commands, use [`AGENTS.md`](../AGENTS.md) (canonical; do not duplicate here).

**Cloud agents:** see [`.cursor/CLOUD-AGENT.md`](CLOUD-AGENT.md) for the full capability matrix, PAT checklist, and cred-vault-on-CI patterns.

---

## Local vs Cloud Agent (summary)

| Capability | Local (`gh` + cred vault) | Cloud Agent (default) | Cloud + PAT secrets |
|------------|---------------------------|------------------------|---------------------|
| `gh pr merge`, view checks | Yes | Yes | Yes |
| `npm run sync:issues` | Yes | **403** (App run token) | Yes — `GH_TOKEN` in dashboard |
| Cred vault (`cred get cursor …`) | Yes | No local path | `CRED_STORE_GPG_BASE64` + pin |
| `wrangler` deploy / KV | Yes (OAuth) | Limited | Partial — vault secrets |
| Firebase admin (Google sign-in) | Maizied Chrome | Blocked | Blocked |

**Default rule:** Issue/label/project sync and vault writes → local. **Full parity:** maintainer completes [CLOUD-AGENT § checklist](CLOUD-AGENT.md#one-time-maintainer-checklist-full-github--secrets).

---

## One-time setup (this machine)

Already documented in [`AGENTS.md` § Local machine`](../AGENTS.md#local-machine-full-agent-access):

```bash
nvm use
npm ci && npm ci --prefix website/admin
npm run build -w @lorapok/cursor-monitor-shared
gh auth login
gh auth refresh -h github.com -s repo,workflow,read:project,project
npm run sync:issues
```

**Cred vault** (local only):

| Item | Path |
|------|------|
| GPG store | `/mnt/NewVolume/Personal_Projects/cred/credentials.json.gpg` |
| Passphrase | repo `.cred-vault-passphrase` or `CRED_VAULT_PASSPHRASE` |
| CLI | `cred get cursor <key>` — never paste values in chat/commits |

After vault writes or secret rotation, run applicable sync scripts — [`.cursor/rules/cred-vault-sync-maintain.mdc`](rules/cred-vault-sync-maintain.mdc).

**Admin dev:** `website/admin/.env` (Firebase public config). Optional `GITHUB_TOKEN` for local API middleware. Wrangler: `npx wrangler whoami` in `website/admin/`.

**Agent skills:** `.cursor/skills` → `.agents/skills` (symlink). Global Lorapok skills: `node scripts/sync-global-agent-stack.mjs`.

---

## Current task queue (snapshot)

Registry: [`plan/mission-control-master-tasks.md`](../plan/mission-control-master-tasks.md) · board: [Project #4](https://github.com/users/Maijied/projects/4)

| ID | Status | Notes |
|----|--------|-------|
| ADMIN-03 | In PR | Cross-section refer buttons — [PR #240](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/240) |
| **ADMIN-04** | **next** | Minimal global footer (`/api/health` + site-data) |
| **ADMIN-05** | **next** | Dedupe dashboard KPIs (pairs with ADMIN-04) |

After landing ADMIN-03, say **next** → implement ADMIN-04/05 per registry priority.

---

## Session start checklist

1. `AGENT_INIT.md` → `AGENTS.md` → `plan/mission-control-master-tasks.md`
2. `gh auth status` (local) · `nvm use` · tests if you touched code
3. **Update?** for status-only; **next** to implement top queue item
4. Non-trivial work: `node scripts/procedure-init.mjs --title "…"`

---

*Replaces ephemeral `.cursor/SESSION-HANDOFF.md`. Update the task table when ADMIN-04+ land or queue order changes.*
