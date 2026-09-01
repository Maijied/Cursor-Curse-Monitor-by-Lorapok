import assert from "node:assert/strict";
import { assertAllWorkflowCoverage } from "../website/shared/architecture-workflow-from-mermaid.mjs";

const { ok, failures, results } = assertAllWorkflowCoverage({ minCoverage: 0.9 });

for (const result of results) {
  const pct = Math.round(result.coverage * 100);
  console.log(
    `${result.viewKey}: ${result.matchedCount}/${result.mermaidCount} mermaid nodes (${pct}%)`
  );
  if (!result.ok) {
    for (const miss of result.missing) {
      console.warn(`  missing: ${miss.id} — ${miss.label}`);
    }
  }
}

assert.equal(ok, true, `workflow coverage below 90%: ${failures.map((f) => f.viewKey).join(", ")}`);
console.log("test_architecture_workflow_sync.mjs: OK");
