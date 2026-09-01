/**
 * Guardrail: workflow node labels should stay aligned with Mermaid sources in
 * architecture-diagrams.mjs. Used by tests — not a runtime parser dependency.
 */
import { ARCHITECTURE_VIEWS } from "./architecture-diagrams.mjs";
import { ARCHITECTURE_WORKFLOWS } from "./architecture-workflows.mjs";

/** @param {string} diagram */
export function extractMermaidNodeLabels(diagram) {
  /** @type {Map<string, string>} */
  const nodes = new Map();
  const re = /(\w+)\["([^"]+)"\]/g;
  for (const line of diagram.split("\n")) {
    if (line.trim().startsWith("subgraph")) continue;
    let match;
    while ((match = re.exec(line)) !== null) {
      nodes.set(match[1], match[2].trim());
    }
  }
  return nodes;
}

/** @param {string} viewKey */
export function mermaidLabelsForView(viewKey) {
  const view = ARCHITECTURE_VIEWS[viewKey];
  if (!view) return new Map();
  return extractMermaidNodeLabels(view.diagram);
}

/** @param {string} viewKey */
export function workflowLabelsForView(viewKey) {
  const workflow = ARCHITECTURE_WORKFLOWS[viewKey];
  if (!workflow) return [];
  return workflow.rows.flat().flatMap((node) => [node.label, node.sub ?? ""].filter(Boolean));
}

/** @param {string} label */
function normalizeLabel(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * @param {string} label
 * @param {Set<string>} workflowLabels
 */
function labelMatches(label, workflowLabels) {
  const normalized = normalizeLabel(label);
  if (workflowLabels.has(normalized)) return true;
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 2);
  for (const wl of workflowLabels) {
    if (wl.includes(normalized) || normalized.includes(wl)) return true;
    const overlap = tokens.filter((t) => wl.includes(t));
    if (tokens.length > 0 && overlap.length >= Math.min(2, tokens.length)) return true;
  }
  return false;
}

/**
 * Compare workflow coverage against Mermaid labels for a tab.
 * @param {string} viewKey
 * @param {{ minCoverage?: number }} [options]
 */
export function compareWorkflowMermaidCoverage(viewKey, options = {}) {
  const minCoverage = options.minCoverage ?? 0.9;
  const mermaid = mermaidLabelsForView(viewKey);
  const workflowLabels = new Set(workflowLabelsForView(viewKey).map((l) => normalizeLabel(l)));
  const mermaidEntries = [...mermaid.entries()];

  const matched = [];
  const missing = [];

  for (const [id, label] of mermaidEntries) {
    const hit = labelMatches(label, workflowLabels);
    if (hit) matched.push({ id, label });
    else missing.push({ id, label });
  }

  const coverage = mermaidEntries.length ? matched.length / mermaidEntries.length : 1;

  return {
    viewKey,
    mermaidCount: mermaidEntries.length,
    matchedCount: matched.length,
    coverage,
    ok: coverage >= minCoverage,
    missing,
    matched,
  };
}

/** @param {{ minCoverage?: number }} [options] */
export function assertAllWorkflowCoverage(options = {}) {
  const results = Object.keys(ARCHITECTURE_VIEWS).map((key) =>
    compareWorkflowMermaidCoverage(key, options)
  );
  const failures = results.filter((r) => !r.ok);
  return { results, ok: failures.length === 0, failures };
}
