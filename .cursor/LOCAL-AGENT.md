# Local agent onboarding (durable)

**Audience:** AI agents running on the maintainer's PC — not Cloud Agent VMs.

Read this once per session alongside [`AGENT_INIT.md`](../AGENT_INIT.md). For build/test/deploy commands, use [`AGENTS.md`](../AGENTS.md) (canonical; do not duplicate here).

---

## Local vs Cloud Agent

| Capability | Local (`gh` + cred vault) | Cloud Agent |
|------------|---------------------------|-------------|
| `gh pr merge`, view checks | Yes | Yes |
| `npm run sync:issues` (labels, issues, Project #4) | Yes | Often **403** (integration token) |
| Cred vault (`cred get cursor …`) | Yes | No — vault is on this machine only |
| `wrangler` deploy / KV | Yes (OAuth in `~/.config/.wrangler`) | Limited |
| Firebase admin dashboard (Google sign-in) | User browser | Headless login blocked |

**Rule:** Issue/label/project sync and secret reads → run locally. Cloud agents can implement and open PRs; maintainer or local agent runs `sync:issues` when the board must update.

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
