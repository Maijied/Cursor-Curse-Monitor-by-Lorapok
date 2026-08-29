---
name: "loragent-system-knowledge"
description: "Complete architectural reference for the Loragent 165-agent ecosystem — LLDP layers, naming conventions, agent hierarchy, sync pipeline, cross-OS paths, and CLI commands."
---

# Loragent System Knowledge — Agent Cheatsheet

**Purpose:** Instant context for any AI session working on the Loragent codebase. Read this before modifying any file.

---

## 1. LLDP Architecture (5 Layers)

The codebase follows the **Lorapok Labs Design Pattern (LLDP)**. Every file lives in one of these layers:

| Layer | Directory | Purpose | Key Files |
|-------|-----------|---------|-----------|
| **FACE** | `face/cli/` | User-facing CLI (commander.js) | `index.js`, `autopilot.js`, `commands/` |
| **PULSE** | `pulse/daemon/` | Background state monitoring | `state-watcher.js` |
| **LORE** | `lore/models/` | Domain models & business logic | `agent.js`, `platform.js` |
| **PORT** | `port/mcp/` | External interfaces (MCP server) | `server.js` (7 MCP tools) |
| **LOOM** | `loom/` | Orchestration, DI, workflows | `di.js`, `automations/`, `steer/`, `workflows/` |

**Rule:** New files MUST be placed in the correct LLDP layer. CLI commands → FACE. Models → LORE. External APIs → PORT. Orchestration → LOOM.

---

## 2. Naming Conventions

All Lorapok agent artifacts **must** start with `loragent-`:

| Type | Format | Location | Example |
|------|--------|----------|---------|
| Agent | `loragent-<name>` | `agents/<name>/SKILL.md` | `agents/boss/SKILL.md` |
| Skill | `loragent-<name>` | `skills/loragent-<name>/SKILL.md` | `skills/loragent-unified-deployment/SKILL.md` |
| Rule | `loragent-<name>.mdc` | `rules/` | `rules/loragent-deployment.mdc` |
| Subagent | `loragent-<name>.md` | `subagents/` | `subagents/loragent-marketplace-publisher.md` |
| MCP Server | `loragent` | `mcp/mcp.json` | Server ID: `loragent` |

---

## 3. Agent Hierarchy

### Core Agents (5) — Always Resident
These 5 are installed in every project workspace:
- `loragent-boss` — Central orchestrator
- `loragent-teacher` — Prompt clarifier
- `loragent-spidernet` — Multi-agent coordinator
- `loragent-watchman` — State cache & crash recovery
- `loragent-workspace-guard` — Security enforcer

### 4 Formation Modes
| Formation | Purpose | Key Agents |
|-----------|---------|------------|
| **Auto Team** | Standard engineering | tech-director, backend-se, frontend-se, sqa, devops, team-lead |
| **Office** | Business & marketing | project-coordinator, project-manager, marketing-strategy-manager, publisher, pr-specialist, hr, sales-executive, business-expert, client |
| **Freelance** | Isolated specialist work | Any 140+ specialist agents |
| **Chela** | Aggressive bug hunting | bug-hunter, shift-engineer, git-specialist, debugger, inspector |

### Agent Statistics
- **165 total agents** (113 native + 52 imported)
- **22 categories**: engineering, orchestration, quality, devops, security, creative, business, documentation, language-expert, cloud, data, tools, publishing, communication, research, monitoring, browser, media, network, seo, freqghost, general

---

## 4. Agent File Format

Every agent directory contains:
- `SKILL.md` — Agent persona and instructions (YAML frontmatter + markdown body)
- `_source.md` — Original imported content (only for imported agents)
- `manifest.json` — Machine-readable metadata (v2.0)

### SKILL.md Structure
```markdown
---
name: "loragent-<name>"
description: "<one-line description>"
---

# Lorapok Mega-Agency: <TITLE>

**Role:** Specialist Agent within the Loragent Ecosystem
**Core Philosophy:** Lorapok Labs' "Engineering-First & Sensory Computing"

## Primary Objective
<agent-specific instructions>

---

## Core Ecosystem Philosophies (Lorapok Labs)
1. Engineering-First Approach
2. Sensory Computing & Biological UI
3. Strict Handoffs
4. Data Security (Vault)

---

## Execution Directives
- Input Context, Output Standard, Failure Handling, Guardrails
```

---

## 5. Import Sources

Agents are imported from these external projects during `loragent sync`:

| Source ID | Project | Scan Paths | Name Transform |
|-----------|---------|------------|----------------|
| `lorapok-ai-agent` | `lorapok_ai_agent` | `.agents/subagents/` | Strip `lorapok-` prefix |
| `lorapok-player` | `lorapok_player` | `.agents/` | Strip `lorapok-` prefix |
| `aswitch-i` | `AswitchI` | `.agents/` | Keep as-is |
| `freqghost` | Global cursor skills | `~/.skills/` | Filter: `freqghost-*` |
| `ide-skills` | Global cursor skills | `~/.skills/` | Filter: `loragent-*`, `lorapok-*`, whitelisted names |

---

## 6. Global Distribution Paths

When syncing, content is distributed to these IDE-specific directories:

### Agents → Global Roster
- `~/.loragent/master-roster/skills/<agent-name>/`

### Skills → IDE Skills Directories
- `~/.skills/<skill-name>/`
- `~/.agents/skills/<skill-name>/`
- `~/.claude/skills/<skill-name>/`

### Rules → Editor Rule Files
- `rules/AGENTS.md` → `.cursorrules`, `.windsurfrules`, `.clinerules`, `CLAUDE.md`
- `.mdc` rules → `~/.rules/`

### MCPs → IDE MCP Configs
- `~/mcp.json`
- `~/.agents/mcp.json`
- `~/.config/Code/User/mcp.json` (Linux) / `~/Library/Application Support/Code/User/mcp.json` (macOS) / `%APPDATA%\Code\User\mcp.json` (Windows)
- `~/.kiro/settings/mcp.json`
- `~/.gemini/config/mcp_config.json`

---

## 7. MCP Server Tools

The native MCP server (`port/mcp/server.js`) exposes:

| Tool | Purpose |
|------|---------|
| `loragent_steer` | Pass context/payload to next agent in pipeline |
| `loragent_trigger_hook` | Trigger lifecycle hooks (pre-commit, deploy-retry) |
| `loragent_get_state` | Read current Boss Mode workflow state |
| `loragent_watchman_save` | Save session state for crash recovery |
| `loragent_summon_agent` | Lazy-load a specialist from global roster |
| `loragent_dismiss_agent` | Remove specialist from workspace (garbage collection) |
| `loragent_list_agents` | Query agent index with filters |
| `loragent_search_agents` | Keyword search across agents |

---

## 8. Key Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `scripts/sync-agents.js` | `node scripts/sync-agents.js` | Scan sources, import agents, rebuild index |
| `scripts/sync-loragent-stack.sh` | `bash scripts/sync-loragent-stack.sh` | Copy skills/MCPs to global IDE dirs |
| `scripts/sync-editor-rules.js` | `npm run sync-rules` | Copy AGENTS.md to all editor rule files |
| `scripts/enrich-skills.cjs` | `node scripts/enrich-skills.cjs` | Wrap SKILL.md with AGENT_TEMPLATE boilerplate |
| `bin/install-officers.py` | `python bin/install-officers.py` | Install core+global agents into workspace |

---

## 9. Key Indexes

| File | Format | Purpose |
|------|--------|---------|
| `agent-index.json` | JSON | Machine-readable catalog of all 165 agents |
| `AGENT_INDEX.md` | Markdown | Human-readable agent catalog with tables |
| `mcp/unified-mcp-registry.json` | JSON | All discovered MCP servers across IDEs |

---

## 10. Critical Rules

1. **Never hardcode paths** — Use `os.homedir()` and `path.join()` for cross-OS compatibility
2. **Agents use lazy-loading** — Only 5 core agents installed locally; rest summoned via MCP
3. **No plaintext secrets** — Use `secure-cred-vault` protocol via `loragent-accounts-specialist`
4. **Destructive ops require confirmation** — `loragent-workspace-guard` blocks `rm -rf`, `DROP TABLE`, etc.
5. **All outputs route back to Boss** — Strict hub-and-spoke; no unauthorized cross-agent communication
6. **LLDP layer discipline** — Don't put CLI logic in LORE, don't put models in FACE
