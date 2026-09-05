#!/usr/bin/env node
/**
 * Professional setup for GitHub Project #4: description, README, milestones,
 * project field values (Status, Priority), issue milestones + labels.
 *
 *   node scripts/setup-github-project.mjs [--dry-run]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadProcedureConfig, repoRootPath } from "./lib/procedure-config.mjs";
import { ghGraphql } from "./lib/github-graphql.mjs";

const MILESTONES_PATH = resolve(repoRootPath(), "procedure/github-milestones.json");
const FIELDS_PATH = resolve(repoRootPath(), "procedure/github-project-fields.json");
const REGISTRY_PATH = resolve(repoRootPath(), "procedure/mission-control-issues.json");
const README_PATH = resolve(repoRootPath(), "procedure/github-project-readme.md");

function gh(args, opts = {}) {
  const r = spawnSync("gh", args, { encoding: "utf8", env: process.env, input: opts.input });
  return { ok: (r.status ?? 1) === 0, stdout: (r.stdout ?? "").trim(), stderr: (r.stderr ?? "").trim() };
}

function gql(query, variables = {}) {
  return ghGraphql(query, variables);
}

function parseArgs(argv) {
  return { dryRun: argv.includes("--dry-run") };
}

function priorityForTask(taskId, priorityQueue) {
  if (priorityQueue.P0?.includes(taskId)) return "P0";
  if (priorityQueue.P1?.includes(taskId)) return "P1";
  return "P2";
}

function milestoneForSection(section, milestones) {
  for (const m of milestones) {
    if (m.sections?.includes(section)) return m.title;
  }
  return "MC — Observability";
}

function ensureMilestones(repo, milestones, dryRun) {
  const existing = gh(["api", `repos/${repo}/milestones?state=all&per_page=100`]);
  const list = existing.ok ? JSON.parse(existing.stdout) : [];
  const byTitle = new Map(list.map((m) => [m.title, m]));

  const map = {};
  for (const m of milestones) {
    if (byTitle.has(m.title)) {
      map[m.title] = byTitle.get(m.title).number;
      console.log(`· Milestone exists: ${m.title} (#${map[m.title]})`);
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] Would create milestone: ${m.title}`);
      continue;
    }
    const create = gh([
      "api",
      `repos/${repo}/milestones`,
      "--method",
      "POST",
      "--input",
      "-",
    ], { input: JSON.stringify({ title: m.title, description: m.description, state: "open" }) });
    if (create.ok) {
      const num = JSON.parse(create.stdout).number;
      map[m.title] = num;
      console.log(`✓ Milestone: ${m.title} (#${num})`);
    } else {
      console.warn(`✗ Milestone ${m.title}:`, create.stderr);
    }
  }
  return map;
}

function updateProjectMeta(config, fields, readme, dryRun) {
  const shortDescription =
    "Public planning board for Cursor Curse Monitor — Mission Control tasks, epics, and priority queue.";
  if (dryRun) {
    console.log("[dry-run] Would update project description + README");
    return;
  }
  const mutation = `mutation($pid:ID!,$desc:String!,$readme:String!){
    updateProjectV2(input:{projectId:$pid,shortDescription:$desc,readme:$readme}){projectV2{id}}
  }`;
  const res = gql(mutation, {
    pid: fields.projectId,
    desc: shortDescription,
    readme,
  });
  if (res.ok) console.log("✓ Project description + README updated");
  else console.warn("✗ Project meta:", res.error);
}

function fetchProjectItems(owner, projectNumber) {
  const q = `query($login:String!,$n:Int!,$after:String){
    user(login:$login){projectV2(number:$n){
      items(first:100,after:$after){
        pageInfo{hasNextPage endCursor}
        nodes{id content{__typename ... on Issue{number}}}
      }
    }}
  }`;
  const items = [];
  let after = null;
  for (;;) {
    const vars = { login: owner, n: projectNumber };
    if (after) vars.after = after;
    const res = gql(q, vars);
    if (!res.ok) break;
    const batch = res.data?.user?.projectV2?.items;
    if (!batch) break;
    for (const node of batch.nodes) {
      if (node.content?.__typename === "Issue") items.push({ itemId: node.id, number: node.content.number });
    }
    if (!batch.pageInfo.hasNextPage) break;
    after = batch.pageInfo.endCursor;
  }
  return items;
}

function setProjectField(projectId, itemId, fieldId, optionId, dryRun) {
  if (dryRun) return true;
  const mutation = `mutation($pid:ID!,$iid:ID!,$fid:ID!,$oid:String!){
    updateProjectV2ItemFieldValue(input:{
      projectId:$pid,itemId:$iid,fieldId:$fid,
      value:{singleSelectOptionId:$oid}
    }){projectV2Item{id}}
  }`;
  const res = gql(mutation, { pid: projectId, iid: itemId, fid: fieldId, oid: optionId });
  return res.ok;
}

function main() {
  const args = parseArgs(process.argv);
  const config = loadProcedureConfig();
  const repo = `${config.owner}/${config.repo}`;
  const fields = JSON.parse(readFileSync(FIELDS_PATH, "utf8"));
  const { milestones, priorityQueue } = JSON.parse(readFileSync(MILESTONES_PATH, "utf8"));
  const readme = readFileSync(README_PATH, "utf8");

  updateProjectMeta(config, fields, readme, args.dryRun);
  const milestoneMap = ensureMilestones(repo, milestones, args.dryRun);

  if (!existsSync(REGISTRY_PATH)) {
    console.warn("No registry at procedure/mission-control-issues.json — run sync:tasks first");
    return;
  }
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));

  const itemByIssue = args.dryRun ? new Map() : new Map(fetchProjectItems(config.owner, config.projectNumber).map((i) => [i.number, i.itemId]));

  for (const [taskId, meta] of Object.entries(registry.tasks ?? {})) {
    const priority = priorityForTask(taskId, priorityQueue);
    const milestoneTitle = milestoneForSection(meta.section, milestones);
    const milestoneNum = milestoneMap[milestoneTitle];
    if (!milestoneNum) {
      console.warn(`⚠ No milestone for ${taskId} (${milestoneTitle})`);
      continue;
    }

    const labels = [
      "type:task",
      "mission-control",
      `priority:${priority.toLowerCase()}`,
      meta.status === "partial" ? "status:partial" : null,
    ].filter(Boolean);

    if (!args.dryRun) {
      const editArgs = ["issue", "edit", String(meta.number), "--repo", repo, "--milestone", milestoneTitle];
      for (const l of labels) editArgs.push("--add-label", l);
      const edit = gh(editArgs);
      if (edit.ok) console.log(`✓ #${meta.number} [${taskId}] milestone=${milestoneTitle} priority=${priority}`);
      else console.warn(`✗ #${meta.number}:`, edit.stderr);

      const itemId = itemByIssue.get(meta.number);
      if (itemId) {
        const statusKey = meta.status === "partial" ? fields.defaults.partialStatus : fields.defaults.taskStatus;
        const statusOpt = fields.fields.status.options[statusKey];
        const priOpt = fields.fields.priority.options[priority];
        setProjectField(fields.projectId, itemId, fields.fields.status.id, statusOpt, args.dryRun);
        setProjectField(fields.projectId, itemId, fields.fields.priority.id, priOpt, args.dryRun);
      }
    } else {
      console.log(`[dry-run] #${meta.number} [${taskId}] → ${milestoneTitle}, ${priority}`);
    }
  }

  // Epics: type:epic, Todo status
  for (const [, meta] of Object.entries(registry.sections ?? {})) {
    if (args.dryRun) continue;
    gh(["issue", "edit", String(meta.number), "--repo", repo, "--add-label", "type:epic"]);
    const itemId = itemByIssue.get(meta.number);
    if (itemId) {
      setProjectField(
        fields.projectId,
        itemId,
        fields.fields.status.id,
        fields.fields.status.options[fields.defaults.epicStatus],
        false
      );
    }
  }
  if (registry.epicNumber && !args.dryRun) {
    gh(["issue", "edit", String(registry.epicNumber), "--repo", repo, "--add-label", "type:epic"]);
  }

  console.log("\n✓ GitHub Project setup complete");
}

main();
