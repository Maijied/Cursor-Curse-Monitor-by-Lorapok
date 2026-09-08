# Session handoff — cloud → local (2026-09-07)

**Purpose:** Carry Mission Control context when moving from Cloud Agent to local Cursor on your machine. Read this once at the start of the next local session, then say **Update?** for a fresh snapshot.

---

## Where we left off

| Item | State |
|------|--------|
| **`main`** | `4cc052cd` — DC-07/08/09 Discord CI cards + Settings gallery merged (#238) |
| **Registry** | AUTH-13 **done**; DC-07/08/09 **done**; DC-06 **partial** |
| **Next queue** | **ADMIN-03 / ADMIN-04 / ADMIN-05** (refer buttons, minimal footer, dedupe Overview) |
| **Open PRs** | None from this session ( #236–#238 merged ) |
| **CI** | Green on `main` |

### Shipped this session

- Full project review on `main` (tests/builds pass)
- **AUTH-13** ACL audit UI — already on `main` (PR #231); registry updated (#237)
- **DC-07** Discord card gallery + test-send matrix in Settings
- **DC-08/09** CI success/failure Discord cards with CHANGELOG + site-data enrichment
- **AGENTS.md** admin lint docs fixed (#236)

### Not finished (needs local `gh` or maintainer)

- **GitHub label sync** — cloud App token cannot create/update labels (403)
- **Project #4 field updates** — partial 403 on issue label/milestone writes
- **Issue close** #205, #206, #151 — 403 from cloud token (may already be closed by PR keywords)
- **Discord live verify** — Settings → Discord → gallery test-send (needs `DISCORD_DEPLOYMENT_WEBHOOK`)

---

## One-time local setup (full agent access)

Run on **your machine** after cloning/pulling `main`:

```bash
# 1. Node 24 (matches .nvmrc + CI)
nvm install && nvm use

# 2. Dependencies + shared package (required before root npm test)
npm ci
npm ci --prefix website/admin
npm run build -w @lorapok/cursor-monitor-shared

# 3. GitHub CLI — personal auth (NOT the cloud App integration token)
gh auth login
gh auth refresh -h github.com -s repo,workflow,read:project,project

# 4. Verify full Mission Control sync works
npm run sync:issues

# 5. Optional: cred vault + admin dev (see AGENTS.md)
# echo passphrase > .cred-vault-passphrase   # gitignored
# cp website/admin/.env.example website/admin/.env   # add GITHUB_TOKEN if needed
```

**Success checks:**

```bash
gh auth status                    # your GitHub user, not "cursor" App
gh api user -q .login             # should print your username (not 403)
npm run sync:labels               # should create/update labels without 403
```

---

## Cloud vs local — `gh` capabilities

| Action | Cloud Agent (App token) | Local (`gh auth login`) |
|--------|-------------------------|-------------------------|
| Read PRs / CI | ✓ | ✓ |
| Merge PRs (via `gh` / ManagePullRequest) | ✓ | ✓ |
| `npm run sync:tasks` | ✓ | ✓ |
| `npm run sync:labels` | ✗ 403 | ✓ after auth refresh |
| Close/update issues, Project #4 fields | ✗ 403 | ✓ after auth refresh |
| Cred vault (`/mnt/NewVolume/…`) | ✗ not mounted | ✓ on maintainer PC |
| Browser (Maizied Chrome profile) | VM Chrome | Your signed-in Chrome |

---

## Resume commands

| You say | Agent does |
|---------|------------|
| **Update?** | Fresh status from `plan/mission-control-master-tasks.md` + CI |
| **next** | Implement **ADMIN-03 / 04 / 05** (top of queue) |
| **sync issues** | `npm run sync:issues` (labels + tasks + Project #4) |

---

## Related docs

- [`AGENT_INIT.md`](../AGENT_INIT.md) — agent commands
- [`TASK-TRACKING.md`](../TASK-TRACKING.md) — GitHub Project workflow
- [`AGENTS.md`](../AGENTS.md) — build/test/deploy per component
- [`plan/mission-control-master-tasks.md`](../plan/mission-control-master-tasks.md) — task registry

*Delete or archive this file after the local session is fully bootstrapped and `sync:issues` succeeds.*
