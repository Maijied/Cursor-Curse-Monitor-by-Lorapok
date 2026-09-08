# Cloud agent onboarding (durable)

**Audience:** AI agents running in **Cursor Cloud Agent** VMs — not the maintainer's local PC.

Read once per session with [`AGENT_INIT.md`](../AGENT_INIT.md). Build/test/deploy commands stay in [`AGENTS.md`](../AGENTS.md). Local-machine setup: [`.cursor/LOCAL-AGENT.md`](LOCAL-AGENT.md).

---

## Detect your environment

| Signal | You are |
|--------|---------|
| Path `/mnt/NewVolume/Personal_Projects/cred/credentials.json.gpg` exists | **Local** → read `LOCAL-AGENT.md` |
| `gh auth status` shows user **Maijied** (not `cursor[bot]` / integration) | **Local** |
| Ubuntu cloud VM, `gh auth status` shows **cursor** GitHub App token | **Cloud** → this file |
| Cursor Cloud Agents dashboard started the run | **Cloud** |

---

## Capability matrix (local vs cloud)

| Capability | Local agent | Cloud agent (default App token) | Cloud agent (+ maintainer secrets) |
|------------|-------------|----------------------------------|-------------------------------------|
| Clone, branch, commit, push | Yes | Yes | Yes |
| `gh pr view`, `gh pr checks`, `gh pr merge` | Yes | Yes | Yes |
| `npm ci`, `npm test`, `npm run build` | Yes | Yes (via `.cursor/environment.json` install) | Yes |
| `gh issue list/view`, close issues | Yes | **403** — issues scope missing from run token | Yes — with `GH_TOKEN` PAT |
| `npm run sync:labels` / `sync:issues` | Yes | **403** on label/issue/project writes | Yes — with `GH_TOKEN` PAT (`project` scope) |
| Project #4 field updates | Yes | **403** | Yes — with PAT + `read:project,project` |
| Cred vault `cred get cursor …` | Yes (local GPG path) | No local path | Yes — `CRED_VAULT_PASSPHRASE` + `CRED_STORE_GPG_BASE64` secrets |
| `wrangler deploy` / KV | Yes (local OAuth) | No OAuth | Partial — deploy tokens via vault secrets |
| Firebase admin UI (Google sign-in) | User Maizied Chrome | Blocked headless | Blocked — use API/tests, not dashboard |
| Browser MCP (Maizied profile) | Yes (`user-browsermcp`) | No — VM has no user Chrome | Use `cursor-ide-browser` on cloud tab |
| Production deploy / mail repair | Yes | Defer to maintainer or CI | Only with vault + Cloudflare secrets in dashboard |

**Default rule without PAT:** implement code, open PRs, run tests; ask maintainer or a **local** agent for `sync:issues`, vault writes, wrangler OAuth, and signed-in browser flows.

**Full parity rule:** maintainer completes the [one-time checklist](#one-time-maintainer-checklist-full-github--secrets) below.

---

## What works out of the box (today)

After `.cursor/environment.json` **install** runs on a Build:

```bash
npm ci && npm ci --prefix website/admin
npm run build -w @lorapok/cursor-monitor-shared
node scripts/sync-global-agent-stack.mjs
```

Cloud agents can:

- Implement features on a branch and push commits (Cursor GitHub App `contents:write`)
- Open and merge PRs when checks pass (`gh pr merge`, ManagePullRequest)
- Run the full headless test matrix (`npm test`, `npm run browser-ext:test`, `npm test` in `website/admin/`)
- Run `npm run sync:tasks` **only if** `GH_TOKEN` is configured — otherwise expect `403 Resource not accessible by integration`
- Read registry and procedure docs; run `procedure-init` if `gh` has issue write via PAT

---

## GitHub: why `403` happens (and the fix)

The [Cursor GitHub App](https://github.com/apps/cursor) shows **Issues: Read and write** at install time, but each Cloud Agent run receives a **narrower** installation token (`ghs_…`) that omits the **issues** scope. Labels, assignees, issue close, and Project field updates use the Issues API → `Resource not accessible by integration`.

This is a known Cursor limitation (not a repo misconfiguration). Cursor staff recommend a **fine-grained PAT** in Cloud Agent secrets until the run token includes issues.

**Official / community references:**

- [Cloud agent setup — secrets](https://cursor.com/docs/cloud-agent/setup#environment-variables-and-secrets)
- [Forum: cloud agent can't read issues](https://forum.cursor.com/t/cursor-cloud-agent-cant-read-issues/169153)
- [Forum: labels / assignees 403](https://forum.cursor.com/t/cursor-github-permissions-to-add-label-and-set-assignee/168757)
- [Forum: issues:write missing from run token](https://forum.cursor.com/t/cloud-agent-gh-git-token-missing-issues-write-despite-github-app-being-granted-issues-read-write/163389)

`git push` / `git pull` still use the App token. The PAT applies to **`gh` CLI and GitHub REST/GraphQL** when exported as `GH_TOKEN` or `GITHUB_TOKEN`.

---

## One-time maintainer checklist (full GitHub + secrets)

Do these in the [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents) → **Secrets** (user or environment scope for this repo's environment).

### 1. GitHub PAT for `gh` (issues, labels, project)

1. GitHub → **Settings → Developer settings → Fine-grained personal access tokens**
2. Resource owner: **Maijied** (or org) · Repositories: **Cursor-Curse-Monitor-by-Lorapok** (or *All repositories*)
3. Permissions:
   - **Issues:** Read and write
   - **Pull requests:** Read and write
   - **Metadata:** Read-only (required)
   - **Contents:** Read and write (optional backup if App token fails)
4. For Project #4 sync, also grant classic scopes via `gh auth refresh` is N/A on cloud — use a **classic PAT** with `repo`, `read:project`, `project` **or** ensure fine-grained token includes organization **Projects** access if GitHub exposes it for your account.
5. Add secret name **`GH_TOKEN`** (exact; not `GITHUB_PAT`) = the PAT value.

**Verify in a cloud agent run:**

```bash
gh auth status          # should show github.com as token from GH_TOKEN, not only ghs_
gh issue list --limit 3
npm run sync:issues     # labels + tasks + project
```

### 2. Cred vault (optional — deploy / mail scripts)

Local vault path is **not** mounted on cloud VMs. Mirror CI instead:

| Secret name | Source |
|-------------|--------|
| `CRED_VAULT_PASSPHRASE` | Same pin as local `.cred-vault-passphrase` (never commit) |
| `CRED_STORE_GPG_BASE64` | GitHub `admin-production` env — sync via `node website/admin/scripts/sync-cred-vault-github.mjs` locally |

**Load into the shell (no values in chat):**

```bash
export CRED_VAULT_PASSPHRASE='…'   # from dashboard secret
export CRED_STORE_GPG_BASE64='…'   # from dashboard secret
eval "$(node website/admin/scripts/load-cred-vault-env-ci.mjs)"
```

Do **not** commit decrypted vault JSON. Scripts export `CLOUDFLARE_*`, `RESEND_*`, etc. for wrangler/mail tooling.

**Skip vault** when running tests that mock secrets:

```bash
CCM_SKIP_CRED_VAULT=1 npm test
```

### 3. Rebuild the Cloud environment

After changing `.cursor/environment.json` or secrets:

1. Push the branch
2. Dashboard → environment → trigger a new **Build** (install script re-runs)
3. Start a cloud agent on that Build

### 4. GitHub App (still required)

Keep the Cursor GitHub App installed on the repo with default permissions — it handles git operations. The PAT **supplements** `gh`; it does not replace App auth for push.

---

## Cred vault: cloud vs local

| Method | Local | Cloud |
|--------|-------|-------|
| `cred get cursor <key>` | Yes — GPG at `/mnt/NewVolume/Personal_Projects/cred/` | No — path absent |
| `CRED_STORE_FILE` + GPG file | Yes | Only if you attach cred store as a **second repo** in a multi-repo environment (advanced) |
| `CRED_STORE_GPG_BASE64` + `CRED_VAULT_PASSPHRASE` | CI / optional local | **Recommended** — Cursor Secrets + `load-cred-vault-env-ci.mjs` |
| `CCM_SKIP_CRED_VAULT=1` | Tests without secrets | Same |

Rule: [`.cursor/rules/cred-vault.mdc`](rules/cred-vault.mdc) — never paste secrets in chat, PRs, or commits.

---

## Browser automation

| Context | Use |
|---------|-----|
| **Local** (maintainer PC) | [`browser-profile.mdc`](rules/browser-profile.mdc) — **Maizied** Chrome via `user-browsermcp` |
| **Cloud VM** | `cursor-ide-browser` MCP — isolated Chrome in the agent VM. **No** Maizied profile, no Cloudflare/Google session |
| **Cloudflare / Google dashboards** | Maintainer runs locally or pastes screenshots; cloud agents use APIs + tests |

Do not expect cloud agents to pass Cloudflare human verification or Firebase Google sign-in.

---

## Session start checklist (cloud)

1. `AGENT_INIT.md` → this file → `AGENTS.md` → `plan/mission-control-master-tasks.md`
2. `gh auth status` — confirm whether `GH_TOKEN` is active
3. If `403` on issues: run code/PR work; note in PR that maintainer should `sync:issues` locally **or** add PAT per checklist above
4. **Update?** / **next** / **autopilot** same as local when `gh` permissions allow
5. Non-trivial work: `node scripts/procedure-init.mjs --title "…"` (needs issue write)

---

## Related

- Local onboarding: [`.cursor/LOCAL-AGENT.md`](LOCAL-AGENT.md)
- Task board ops: [`TASK-TRACKING.md`](../TASK-TRACKING.md)
- Environment install: [`.cursor/environment.json`](environment.json)
- Cursor docs: [Cloud agent setup](https://cursor.com/docs/cloud-agent/setup)

---

*Update this file when Cursor changes cloud token scopes or when new repo secrets are required for cloud parity.*
