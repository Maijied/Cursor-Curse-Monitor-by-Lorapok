export const WORKFLOW_JOB_ORDER = [
  "Build & Validate (Root Extension)",
  "SEO & Metadata Pipeline",
  "Browser Extension CI",
  "Admin Panel CI",
  "Prepare Release Tag (push to main)",
  "Prepare & Tag Release",
  "Deploy to Marketplaces",
  "Deploy Admin Panel",
  "Deploy Marketing Website",
];

/** @param {Array<{ name: string }>} jobs */
export function sortWorkflowJobs(jobs) {
  const order = new Map(WORKFLOW_JOB_ORDER.map((name, index) => [name, index]));
  return [...jobs].sort((a, b) => {
    const ai = order.get(a.name) ?? 999;
    const bi = order.get(b.name) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}
