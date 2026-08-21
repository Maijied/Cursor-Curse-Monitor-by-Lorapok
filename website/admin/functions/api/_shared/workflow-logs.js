/** @param {string} text */
export function isZipArchiveText(text) {
  if (!text || text.length < 2) return false;
  return text.charCodeAt(0) === 0x50 && text.charCodeAt(1) === 0x4b;
}

/** @param {string} text */
export function isReadableLogText(text) {
  if (!text) return false;
  if (isZipArchiveText(text)) return false;
  let nonPrintable = 0;
  const sample = text.slice(0, 2000);
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13) continue;
    if (code < 32 || code === 127) nonPrintable++;
  }
  return nonPrintable / Math.max(sample.length, 1) < 0.05;
}

/**
 * @param {Array<{ name: string, status: number, body: string }>} jobResults
 */
export function buildWorkflowLogText(jobResults) {
  const chunks = [];
  let logsUnavailable = false;

  for (const job of jobResults) {
    if (job.status === 200 && isReadableLogText(job.body)) {
      chunks.push(`=== ${job.name} ===\n${job.body}`);
    } else if (job.status === 200 && isZipArchiveText(job.body)) {
      logsUnavailable = true;
      chunks.push(`=== ${job.name} ===\n(log archive returned as ZIP — open run in GitHub)`);
    } else {
      logsUnavailable = true;
      chunks.push(`=== ${job.name} ===\n(log unavailable: HTTP ${job.status})`);
    }
  }

  return {
    text: chunks.join("\n\n").slice(-120_000),
    logsUnavailable,
    logsHint: logsUnavailable
      ? "Full logs need GITHUB_TOKEN with actions:read. Open the run in GitHub for downloadable logs."
      : undefined,
  };
}

/**
 * @param {Array<{ workflow: string, createdAt: string, status: string }>} runs
 * @param {{ workflowName?: string, dispatchedAfter?: number }} filter
 */
export function pickWorkflowRun(runs, filter = {}) {
  const { workflowName, dispatchedAfter = 0 } = filter;
  const needle = workflowName?.replace(/\.ya?ml$/i, "") ?? "";

  const candidates = runs.filter((run) => {
    const created = new Date(run.createdAt).getTime();
    if (dispatchedAfter && created < dispatchedAfter - 5000) return false;
    if (!needle) return true;
    return run.workflow.toLowerCase().includes(needle.toLowerCase());
  });

  const priority = (run) => {
    if (run.status === "in_progress" || run.status === "queued") return 0;
    if (run.status === "completed") return 1;
    return 2;
  };

  candidates.sort((a, b) => {
    const p = priority(a) - priority(b);
    if (p !== 0) return p;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return candidates[0] ?? null;
}
