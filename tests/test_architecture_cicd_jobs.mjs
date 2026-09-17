/**
 * WEB-07: deployPipeline topology must name every Production Deployment job.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARCHITECTURE_WORKFLOWS } from "../website/shared/architecture-workflows.mjs";
import { ARCHITECTURE_VIEWS } from "../website/shared/architecture-diagrams.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string} yaml */
export function extractCicdJobIds(yaml) {
  const jobs = [];
  let inJobs = false;
  for (const line of yaml.split("\n")) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^[a-zA-Z]/.test(line) && !line.startsWith(" ")) {
      // Top-level key after jobs block ended (unlikely in our file)
      break;
    }
    const m = line.match(/^  ([a-z][a-z0-9_-]*):\s*$/);
    if (m) jobs.push(m[1]);
  }
  return jobs;
}

function haystackForDeployPipeline() {
  const wf = ARCHITECTURE_WORKFLOWS.deployPipeline;
  const labels = wf.rows.flat().flatMap((n) => [n.id, n.label, n.sub ?? ""]);
  const sidebar = wf.sidebar?.items ?? [];
  const mermaid = ARCHITECTURE_VIEWS.deployPipeline.diagram;
  return [...labels, ...sidebar, mermaid].join("\n").toLowerCase();
}

const yaml = readFileSync(join(root, ".github/workflows/ci-cd.yml"), "utf8");
const jobIds = extractCicdJobIds(yaml);
assert.ok(jobIds.length >= 10, `expected many ci-cd jobs, got ${jobIds.length}`);

const hay = haystackForDeployPipeline();
const missing = jobIds.filter((id) => !hay.includes(id.toLowerCase()));

assert.deepEqual(
  missing,
  [],
  `deployPipeline missing ci-cd.yml jobs: ${missing.join(", ")}`
);

console.log(`test_architecture_cicd_jobs.mjs: OK (${jobIds.length} jobs covered)`);
