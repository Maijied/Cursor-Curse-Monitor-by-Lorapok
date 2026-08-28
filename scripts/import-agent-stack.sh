#!/usr/bin/env bash
# Import skills and agents from loragent, global Cursor stacks, and other drives
# into local skill dirs. Does not merge or overwrite MCP configs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOME_CURSOR="${HOME}/.cursor"
HOME_AGENTS="${HOME}/.agents"
HOME_CLAUDE="${HOME}/.claude"
LORAGENT_ROOT="${LORAGENT_ROOT:-/mnt/NewVolume/Personal_Projects/loragent}"
SYNC_BIN="${HOME}/.local/bin/sync-global-agent-stack"
IMPORT_AGENT_FORCE="${IMPORT_AGENT_FORCE:-0}"

# Comma-separated roots to scan. Keep this list explicit — full $HOME scans pull node_modules junk.
DEFAULT_SCAN_ROOTS="/mnt/NewVolume/Personal_Projects/AswitchI,/mnt/NewVolume/Personal_Projects/FreqGhost,/mnt/NewVolume/Personal_Projects/lorapok_player,/mnt/NewVolume/Personal_Projects/lorapok_ai_agent,/mnt/NewVolume/Personal_Projects/loragent-officers,/home/maizied/pc-fix"
IMPORT_AGENT_SCAN_ROOTS="${IMPORT_AGENT_SCAN_ROOTS:-${DEFAULT_SCAN_ROOTS}}"

PROJECT_CURSOR_SKILLS="${ROOT}/.cursor/skills"
PROJECT_AGENTS_SKILLS="${ROOT}/.agents/skills"
PROJECT_AGENTS="${ROOT}/.cursor/agents"

mkdir -p \
  "${HOME_CURSOR}/skills" "${HOME_CURSOR}/agents" \
  "${HOME_AGENTS}/skills" \
  "${HOME_CLAUDE}/skills" \
  "${PROJECT_CURSOR_SKILLS}" "${PROJECT_AGENTS_SKILLS}" "${PROJECT_AGENTS}"

import_skill_dir() {
  local src="$1"
  local label="${2:-${src}}"
  [[ -f "${src}/SKILL.md" ]] || return 0
  local name
  name="$(basename "${src}")"
  if [[ "${IMPORT_AGENT_FORCE}" == "1" ]] || [[ ! -d "${HOME_CURSOR}/skills/${name}" ]]; then
    rsync -a "${src}/" "${HOME_CURSOR}/skills/${name}/"
    echo "    skill: ${name} <- ${label}"
  fi
}

import_agent_md() {
  local src="$1"
  local dest_name="${2:-$(basename "${src}")}"
  [[ -f "${src}" ]] || return 0
  if [[ "${IMPORT_AGENT_FORCE}" == "1" ]] || [[ ! -f "${HOME_CURSOR}/agents/${dest_name}" ]]; then
    cp "${src}" "${HOME_CURSOR}/agents/${dest_name}"
    echo "    agent: ${dest_name}"
  fi
}

prune_agent_skill_duplicates() {
  # Agents imported as skills (e.g. loragent/agents/foo/SKILL.md) should live only under agents/.
  shopt -s nullglob
  for agent_file in "${HOME_CURSOR}/agents/"*.md; do
    local base="${agent_file%.md}"
    base="$(basename "${base}")"
    for target in "${HOME_CURSOR}/skills" "${PROJECT_CURSOR_SKILLS}" "${PROJECT_AGENTS_SKILLS}"; do
      if [[ -d "${target}/${base}" ]]; then
        rm -rf "${target}/${base}"
        echo "    pruned duplicate skill: ${base} (${target})"
      fi
    done
  done
}

import_agents_tree() {
  local agents_root="$1"
  local label="${2:-${agents_root}}"
  [[ -d "${agents_root}" ]] || return 0

  shopt -s nullglob
  for agent_md in "${agents_root}"/*.md; do
    import_agent_md "${agent_md}"
  done
  for agent_dir in "${agents_root}"/*/; do
    [[ -d "${agent_dir}" ]] || continue
    local skill="${agent_dir}SKILL.md"
    [[ -f "${skill}" ]] || continue
    import_agent_md "${skill}" "$(basename "${agent_dir}").md"
  done
}

scan_drive_roots() {
  local scan_root="$1"
  [[ -d "${scan_root}" ]] || return 0
  echo "  scanning ${scan_root}"

  # Skills from project stacks and loragent-style trees.
  while IFS= read -r skill_file; do
    case "${skill_file}" in
      */node_modules/*|*/vendor/*|*/.npm/*|*/dist/*|*/build/*|*/agents/*) continue ;;
    esac
    import_skill_dir "$(dirname "${skill_file}")" "${skill_file}"
  done < <(
    find "${scan_root}" -maxdepth 8 \
      \( -path '*/node_modules/*' -o -path '*/.git/*' -o -path '*/dist/*' -o -path '*/build/*' \) -prune -o \
      \( \
        -path '*/.cursor/skills/*/SKILL.md' -o \
        -path '*/.agents/skills/*/SKILL.md' -o \
        -path '*/.claude/skills/*/SKILL.md' -o \
        -path '*/skills/*/SKILL.md' \
      \) -print 2>/dev/null
  )

  # Agents from project stacks and loragent-style trees (skip paths under skills/).
  while IFS= read -r agents_dir; do
    case "${agents_dir}" in
      */node_modules/*|*/vendor/*|*/packages/*|*/dist/*|*/skills/*) continue ;;
    esac
    import_agents_tree "${agents_dir}"
  done < <(
    find "${scan_root}" -maxdepth 8 \
      \( -path '*/node_modules/*' -o -path '*/.git/*' \) -prune -o \
      \( -path '*/.cursor/agents' -o -path '*/agents' \) -type d -print 2>/dev/null | while read -r dir; do
        case "${dir}" in
          */node_modules/*|*/packages/*|*/dist/*) continue ;;
        esac
        echo "${dir}"
      done
  )

  # MCP configs are discovered for logging only. Never merge them into this repo.
  while IFS= read -r mcp_file; do
    echo "    mcp (not merged): ${mcp_file}"
  done < <(
    find "${scan_root}" -maxdepth 8 \
      \( -path '*/node_modules/*' -o -path '*/.git/*' \) -prune -o \
      \( -path '*/.cursor/mcp.json' -o -path '*/mcp/mcp.json' \) -print 2>/dev/null
  )
}

echo "==> Step 1: sync canonical loragent stack to global (~/.cursor, ~/.agents, ~/.claude)"
for skill_dir in "${LORAGENT_ROOT}"/skills/loragent-*; do
  [[ -d "${skill_dir}" ]] || continue
  skill_name="$(basename "${skill_dir}")"
  rsync -a "${skill_dir}/" "${HOME_CURSOR}/skills/${skill_name}/"
  echo "  synced ${skill_name}"
done
if [[ -f "${LORAGENT_ROOT}/mcp/mcp.json" ]]; then
  echo "  noted loragent MCP at ${LORAGENT_ROOT}/mcp/mcp.json (not copied over ~/.cursor/mcp.json)"
fi

echo "==> Step 2: import plugin-cache skills into global ~/.cursor/skills"
shopt -s nullglob
for skill_dir in "${HOME_CURSOR}"/plugins/cache/*/*/skills/*/; do
  [[ -d "${skill_dir}" ]] || continue
  import_skill_dir "${skill_dir%/}" "plugin-cache"
done

echo "==> Step 3: import from other drives/projects"
IFS=',' read -ra SCAN_ROOTS <<< "${IMPORT_AGENT_SCAN_ROOTS}"
for scan_root in "${SCAN_ROOTS[@]}"; do
  scan_root="${scan_root/#\~/${HOME}}"
  scan_drive_roots "${scan_root}"
done

# Explicit loragent trees (canonical + officers) after drive scan.
import_agents_tree "${LORAGENT_ROOT}/agents" "loragent"
import_agents_tree "${LORAGENT_ROOT%/loragent}/loragent-officers/agents" "loragent-officers"
for skill_dir in "${LORAGENT_ROOT}"/skills/*/; do
  import_skill_dir "${skill_dir%/}" "loragent"
done

echo "==> Step 3b: prune agent/skill duplicates"
prune_agent_skill_duplicates

echo "==> Step 4: mirror global skills across Cursor / Agents / Claude homes"
for target in "${HOME_AGENTS}/skills" "${HOME_CLAUDE}/skills"; do
  rsync -a "${HOME_CURSOR}/skills/" "${target}/"
done

echo "==> Step 5: import into project (${ROOT})"
# Do not --delete: tracked Lorapok skills on main must stay even if missing from $HOME.
rsync -a "${HOME_CURSOR}/skills/" "${PROJECT_CURSOR_SKILLS}/"
rsync -a "${HOME_CURSOR}/skills/" "${PROJECT_AGENTS_SKILLS}/"
rsync -a --include='*.md' --exclude='*' "${HOME_CURSOR}/agents/" "${PROJECT_AGENTS}/"

echo "==> Step 6: verify committed project MCP (never merge scanned servers)"
node "${ROOT}/scripts/project-mcp-policy.mjs"
echo "  left .cursor/mcp.json unchanged (Cloudflare-only source of truth)"
echo "  left ~/.cursor/mcp.json unchanged (scanned project MCP is not imported)"

skill_count="$(find "${PROJECT_CURSOR_SKILLS}" -mindepth 1 -maxdepth 1 -type d | wc -l)"
agent_count="$(find "${PROJECT_AGENTS}" -maxdepth 1 -name '*.md' | wc -l)"

echo "==> Done"
echo "  project skills: ${skill_count}"
echo "  project agents: ${agent_count}"
echo "  scan roots: ${IMPORT_AGENT_SCAN_ROOTS}"
echo "  extra skill folders stay gitignored; they are local-only"
echo "  tip: IMPORT_AGENT_SCAN_ROOTS=/mnt/NewVolume/Personal_Projects for wider scans"
echo "  Reload Cursor window to pick up skill changes."
