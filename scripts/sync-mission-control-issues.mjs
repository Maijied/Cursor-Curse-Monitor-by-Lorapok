#!/usr/bin/env node
/**
 * Sync Mission Control master task registry → GitHub issues + sub-issues + Project board.
 *
 *   node scripts/sync-mission-control-issues.mjs [--dry-run] [--status next,partial] [--add-to-project]
 *
 * Reads: plan/mission-control-master-tasks.md
 * Config: procedure/project.json
 *
 * Creates (when missing):
 *   - Epic: Mission Control open backlog (top parent)
 *   - Epic per section (e.g. Auth, Mail) as sub-issue of top epic
 *   - Task issues [TASK-ID] Title as sub-issues of section epic
 *
 * Idempotent: skips issues whose title already starts with [TASK-ID].
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadProcedureConfig, repoRootPath } from "./lib/procedure-config.mjs";

const MASTER_TASKS = resolve(repoRootPath(), "plan/mission-control-master-tasks.md");
const TRACKING_REGISTRY = resolve(repoRootPath(), "procedure/mission-control-issues.json");

const SECTION_LABELS = {
  "Cloudflare KV": ["area:infra", "mission-control"],
  "Cloudflare D1": ["area:infra", "mission-control"],
  "Cloudflare R2": ["area:infra", "mission-control"],
  "Cloudflare Pages / Workers": ["area:infra", "mission-control"],
  Firebase: ["area:auth", "mission-control"],
  GitHub: ["mission-control"],
  "Microsoft Azure": ["area:infra", "mission-control"],
  "Google Cloud (GCP / GCS)": ["area:infra", "mission-control"],
  "Mail (Resend + Cloudflare Email)": ["area:mail", "mission-control"],
  Discord: ["area:discord", "mission-control"],
  "Stats / Cron": ["area:analytics", "mission-control"],
  "IDE extension": ["area:extension", "mission-control"],
  "Browser extension": ["area:extension", "mission-control"],
  "Marketing website": ["area:website", "mission-control"],
  "Settings UX (cross-cutting)": ["area:admin", "mission-control"],
};

const STATUS_LABELS = {
  next: "enhancement",
  partial: "status:partial",
  deferred: "status:deferred",
};

function parseArgs(argv) {
  const out = {
    dryRun: false,
    addToProject: false,
    statuses: new Set(["next", "partial"]),
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--add-to-project") out.addToProject = true;
    else if (arg === "--status" && argv[i + 1]) {
      out.statuses = new Set(argv[++i].split(",").map((s) => s.trim().toLowerCase()));
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/sync-mission-control-issues.mjs [options]

Options:
  --dry-run           Parse and print plan only; no GitHub calls
  --add-to-project    Add new issues to Project from procedure/project.json
  --status a,b,c      Sync only these statuses (default: next,partial)
`);
      process.exit(0);
    }
  }
  return out;
}

function gh(args, { input } = {}) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    input,
    env: process.env,
  });
  return {
    ok: (result.status ?? 1) === 0,
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function ghApi(path, { method = "GET", body } = {}) {
  const args = ["api", path, "--method", method];
  if (body) {
    for (const [k, v] of Object.entries(body)) {
      args.push("-f", `${k}=${v}`);
    }
  }
  const result = gh(args);
  if (!result.ok) return { ok: false, error: result.stderr || result.stdout };
  try {
    return { ok: true, data: JSON.parse(result.stdout) };
  } catch {
    return { ok: true, data: result.stdout };
  }
}

function gql(query, variables = {}) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [k, v] of Object.entries(variables)) {
    if (typeof v === "number") args.push("-F", `${k}=${v}`);
    else args.push("-f", `${k}=${v}`);
  }
  const result = gh(args);
  if (!result.ok) return { ok: false, error: result.stderr || result.stdout };
  try {
    const parsed = JSON.parse(result.stdout);
    if (parsed.errors?.length) return { ok: false, error: JSON.stringify(parsed.errors) };
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, error: result.stdout };
  }
}

/** @returns {{ sections: Array<{ name: string; tasks: Array<{ id: string; title: string; status: string; notes: string }> }> }} */
function parseMasterTasks(markdown) {
  const sections = [];
  const parts = markdown.split(/^## /m).slice(1);
  for (const part of parts) {
    const lines = part.split("\n");
    const name = lines[0].trim();
    if (!name || name.startsWith("Epic") || name === "How to use" || name === "Service index (quick scan)") continue;
    if (name.startsWith("Recommended") || name === "Blockers (need you)" || name === "Related plans") break;

    const tasks = [];
    for (const line of lines) {
      const m = line.match(/^\|\s*([A-Z]+-\d+)\s*\|\s*(.+?)\s*\|\s*\*\*(next|done|partial|deferred)\*\*\s*\|/);
      if (!m) continue;
      const [, id, title, status] = m;
      const notes = line.split("|").slice(4).join("|").trim();
      tasks.push({ id, title: title.replace(/\*\*/g, "").trim(), status, notes });
    }
    if (tasks.length) sections.push({ name, tasks });
  }
  return { sections };
}

function dedupeTasks(tasks) {
  const rank = { next: 3, partial: 2, deferred: 1, done: 0 };
  const byId = new Map();
  for (const task of tasks) {
    const prev = byId.get(task.id);
    if (!prev || (rank[task.status] ?? 0) > (rank[prev.status] ?? 0)) byId.set(task.id, task);
  }
  return [...byId.values()];
}

function loadRegistry() {
  if (!existsSync(TRACKING_REGISTRY)) {
    return { version: 1, epicNumber: null, sections: {}, tasks: {}, updatedAt: null };
  }
  return JSON.parse(readFileSync(TRACKING_REGISTRY, "utf8"));
}

async function main() {
  const args = parseArgs(process.argv);
  const config = loadProcedureConfig();
  const markdown = readFileSync(MASTER_TASKS, "utf8");
  const { sections } = parseMasterTasks(markdown);

  const toSync = sections
    .map((section) => ({
      ...section,
      tasks: dedupeTasks(
        section.tasks.filter((t) => args.statuses.has(t.status) && t.status !== "done")
      ),
    }))
    .filter((s) => s.tasks.length > 0);

  if (args.dryRun) {
    console.log(JSON.stringify({ sections: toSync.length, tasks: toSync.reduce((n, s) => n + s.tasks.length, 0), toSync }, null, 2));
    return;
  }

  const registry = loadRegistry();
  const repo = `${config.owner}/${config.repo}`;

  // Fetch existing issues (open + closed) with mission-control label
  const listResult = gh([
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "all",
    "--limit",
    "500",
    "--json",
    "number,title,url",
  ]);
  if (!listResult.ok) {
    console.error("Failed to list issues:", listResult.stderr);
    process.exit(1);
  }
  const existing = JSON.parse(listResult.stdout);
  const byTaskId = new Map();
  for (const issue of existing) {
    const m = issue.title.match(/^\[([A-Z]+-\d+)\]/);
    if (m) byTaskId.set(m[1], issue);
  }

  function issueNodeId(number) {
    const q =
      "query($owner:String!,$repo:String!,$n:Int!){repository(owner:$owner,name:$repo){issue(number:$n){id}}}";
    const res = gql(q, { owner: config.owner, repo: config.repo, n: number });
    return res.ok ? res.data?.repository?.issue?.id : null;
  }

  function addSubIssue(parentNumber, childNumber) {
    const parentId = issueNodeId(parentNumber);
    const childId = issueNodeId(childNumber);
    if (!parentId || !childId) return false;
    const mutation = `mutation($p:ID!,$c:ID!){addSubIssue(input:{issueId:$p,subIssueId:$c}){subIssue{id}}}`;
    const res = gql(mutation, { p: parentId, c: childId });
    return res.ok;
  }

  function createIssue({ title, body, labels }) {
    const issueArgs = ["issue", "create", "--repo", repo, "--title", title, "--body", body];
    for (const label of labels) issueArgs.push("--label", label);
    const result = gh(issueArgs);
    if (!result.ok) {
      console.error(`✗ Create failed: ${title}`, result.stderr);
      return null;
    }
    const url = result.stdout;
    const number = Number(url.match(/\/issues\/(\d+)/)?.[1]);
    console.log(`✓ Issue #${number}: ${title}`);

    if (args.addToProject && config.projectNumber != null) {
      const add = gh([
        "project",
        "item-add",
        String(config.projectNumber),
        "--owner",
        config.owner,
        "--url",
        url,
      ]);
      if (add.ok) console.log(`  → Project #${config.projectNumber}`);
      else console.warn(`  ⚠ Project add failed: ${add.stderr}`);
    }
    return { number, url };
  }

  // Top epic
  const epicTitle = "Epic: Mission Control — open backlog";
  let epicNumber = registry.epicNumber;
  const epicExisting = existing.find((i) => i.title === epicTitle);
  if (epicExisting) {
    epicNumber = epicExisting.number;
  } else if (!epicNumber) {
    const created = createIssue({
      title: epicTitle,
      body: [
        "Parent epic for Mission Control tasks synced from `plan/mission-control-master-tasks.md`.",
        "",
        "**Process:** [`TASK-TRACKING.md`](../TASK-TRACKING.md) · **Registry:** [`procedure/mission-control-issues.json`](../procedure/mission-control-issues.json)",
        "",
        `Project board: ${config.projectUrl ?? "https://github.com/users/Maijied/projects/4"}`,
        "",
        "Say **next** in Cursor to implement the top priority open task.",
      ].join("\n"),
      labels: ["epic", "type:epic", "mission-control"],
    });
    epicNumber = created?.number ?? null;
  }
  registry.epicNumber = epicNumber;

  for (const section of toSync) {
    const sectionKey = section.name;
    const sectionEpicTitle = `Epic: ${section.name}`;
    let sectionEpicNumber = registry.sections[sectionKey]?.number;
    const sectionExisting = existing.find((i) => i.title === sectionEpicTitle);
    if (sectionExisting) {
      sectionEpicNumber = sectionExisting.number;
    } else if (!sectionEpicNumber) {
      const labels = [...new Set(["epic", "type:epic", "mission-control", ...(SECTION_LABELS[section.name] ?? [])])];
      const created = createIssue({
        title: sectionEpicTitle,
        body: [
          `Section epic for **${section.name}** tasks.`,
          "",
          "Source: `plan/mission-control-master-tasks.md`",
          "",
          "Sub-issues below are individual task IDs (AUTH-13, MAIL-13, …).",
        ].join("\n"),
        labels,
      });
      sectionEpicNumber = created?.number ?? null;
      if (sectionEpicNumber && epicNumber) addSubIssue(epicNumber, sectionEpicNumber);
    }
    registry.sections[sectionKey] = { number: sectionEpicNumber, title: sectionEpicTitle };

    for (const task of section.tasks) {
      const taskTitle = `[${task.id}] ${task.title}`;
      if (byTaskId.has(task.id)) {
        console.log(`· Exists #${byTaskId.get(task.id).number}: ${taskTitle}`);
        registry.tasks[task.id] = {
          number: byTaskId.get(task.id).number,
          url: byTaskId.get(task.id).url,
          status: task.status,
          section: sectionKey,
        };
        continue;
      }

      const labels = [
        "type:task",
        "task",
        "mission-control",
        STATUS_LABELS[task.status] ?? "enhancement",
        ...(SECTION_LABELS[section.name] ?? []),
      ].filter(Boolean);

      const body = [
        `**Task ID:** \`${task.id}\``,
        `**Section:** ${section.name}`,
        `**Status:** ${task.status}`,
        "",
        task.notes ? `**Notes:** ${task.notes}` : "",
        "",
        "## Workflow",
        "1. `node scripts/procedure-init.mjs --title \"…\" --plan plan/…` (optional plan)",
        "2. Implement on branch `feat/${task.id.toLowerCase()}-…`",
        "3. Update `plan/mission-control-master-tasks.md` when done",
        "4. Close this issue when merged",
        "",
        "See [`TASK-TRACKING.md`](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/TASK-TRACKING.md).",
      ]
        .filter(Boolean)
        .join("\n");

      const created = createIssue({ title: taskTitle, body, labels });
      if (created?.number) {
        registry.tasks[task.id] = {
          number: created.number,
          url: created.url,
          status: task.status,
          section: sectionKey,
        };
        if (sectionEpicNumber) addSubIssue(sectionEpicNumber, created.number);
        byTaskId.set(task.id, { number: created.number, url: created.url, title: taskTitle });
      }
    }
  }

  registry.updatedAt = new Date().toISOString();
  writeFileSync(TRACKING_REGISTRY, JSON.stringify(registry, null, 2) + "\n", "utf8");
  console.log(`\n✓ Registry: procedure/mission-control-issues.json`);
  console.log(`✓ Epic: #${epicNumber} — ${epicTitle}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
