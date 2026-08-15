import type { SiteData, VisitorStats } from "./site-data";
import { formatCount, syncStatusLabel } from "./site-data";

export interface StatusReportRow {
  label: string;
  value: string;
  status?: "ok" | "warn" | "danger" | "neutral";
}

export interface StatusReportSection {
  title: string;
  rows: StatusReportRow[];
}

export interface StatusReport {
  generatedAt: string;
  reportTitle: string;
  organization: string;
  product: string;
  summary: StatusReportSection;
  marketplace: StatusReportSection;
  downloads: StatusReportSection;
  engagement: StatusReportSection;
  notice?: StatusReportSection;
}

function rowStatus(ok: boolean, warn?: boolean): StatusReportRow["status"] {
  if (warn) return "warn";
  return ok ? "ok" : "danger";
}

export function buildStatusReport(data: SiteData, visitors: VisitorStats): StatusReport {
  const clicks = visitors.packageClicks ?? {};
  const clickTotal = Object.values(clicks).reduce((s, n) => s + (n ?? 0), 0);
  const downloads = data.downloads;
  const breakdown = downloads?.breakdown;

  const marketplaceRows: StatusReportRow[] = [
    {
      label: "Sync status",
      value: syncStatusLabel(data.syncStatus),
      status: data.syncStatus === "synced" ? "ok" : "warn",
    },
    {
      label: "Package version",
      value: data.packageVersion,
      status: "neutral",
    },
    {
      label: "Published version",
      value: data.version,
      status: data.version === data.packageVersion ? "ok" : "warn",
    },
    {
      label: "GitHub release",
      value: data.github.releaseTag,
      status: rowStatus(data.github.releaseTag.replace(/^v/, "") === data.packageVersion),
    },
    {
      label: "Open VSX (canonical)",
      value: data.ovsx.version ?? "—",
      status: rowStatus(data.ovsx.version === data.packageVersion),
    },
    {
      label: "VS Code Marketplace",
      value: data.vscode.version ?? "—",
      status: rowStatus(data.vscode.version === data.packageVersion),
    },
  ];

  if (data.ovsxDuplicate?.version) {
    marketplaceRows.push({
      label: "Open VSX duplicate listing",
      value: data.ovsxDuplicate.version,
      status: "warn",
    });
  }

  const downloadRows: StatusReportRow[] = [
    {
      label: "Total downloads (deduplicated)",
      value: formatCount(downloads?.total ?? 0),
      status: "neutral",
    },
    {
      label: "Open VSX canonical",
      value: formatCount(breakdown?.openVsxCanonical ?? 0),
      status: "neutral",
    },
    {
      label: "VS Code Marketplace",
      value: formatCount(breakdown?.vscodeMarketplace ?? 0),
      status: "neutral",
    },
    {
      label: "GitHub VSIX assets",
      value: formatCount(breakdown?.githubVsix ?? 0),
      status: "neutral",
    },
    {
      label: "Latest release VSIX",
      value: formatCount(breakdown?.latestReleaseVsix ?? 0),
      status: "neutral",
    },
  ];

  const engagementRows: StatusReportRow[] = [
    { label: "Website visits", value: formatCount(visitors.websiteVisits), status: "neutral" },
    { label: "Package clicks", value: formatCount(clickTotal), status: "neutral" },
    { label: "Total engagement", value: formatCount(visitors.totalEngagement), status: "neutral" },
    {
      label: "Last activity",
      value: visitors.updatedAt ? new Date(visitors.updatedAt).toLocaleString() : "—",
      status: "neutral",
    },
  ];

  Object.entries(clicks).forEach(([key, value]) => {
    engagementRows.push({
      label: `Click · ${key}`,
      value: formatCount(value),
      status: "neutral",
    });
  });

  const noticeSection: StatusReportSection | undefined = data.notice?.enabled
    ? {
        title: data.notice.title,
        rows: [
          { label: "Severity", value: data.notice.severity, status: "warn" },
          { label: "Updated", value: new Date(data.notice.updatedAt).toLocaleString(), status: "neutral" },
          { label: "Message", value: data.notice.message, status: "warn" },
        ],
      }
    : undefined;

  return {
    generatedAt: new Date().toISOString(),
    reportTitle: "Cursor Curse Monitor — Status Report",
    organization: "Lorapok Labs",
    product: "Cursor Curse Monitor by Lorapok",
    summary: {
      title: "Executive Summary",
      rows: [
        { label: "Report generated", value: new Date().toLocaleString(), status: "neutral" },
        { label: "Site data refreshed", value: new Date(data.generatedAt).toLocaleString(), status: "neutral" },
        { label: "Overall sync", value: syncStatusLabel(data.syncStatus), status: data.syncStatus === "synced" ? "ok" : "warn" },
        { label: "Total reach", value: formatCount((downloads?.total ?? 0) + visitors.totalEngagement), status: "neutral" },
      ],
    },
    marketplace: { title: "Marketplace & Release Records", rows: marketplaceRows },
    downloads: { title: "Download Records", rows: downloadRows },
    engagement: { title: "Website & Engagement Records", rows: engagementRows },
    notice: noticeSection,
  };
}

export function reportToJson(report: StatusReport): string {
  return JSON.stringify(report, null, 2);
}

export function reportToHtml(report: StatusReport): string {
  const sectionHtml = (section: StatusReportSection) => `
    <section>
      <h2>${section.title}</h2>
      <table>
        <thead><tr><th>Record</th><th>Value</th><th>Status</th></tr></thead>
        <tbody>
          ${section.rows
            .map(
              (r) =>
                `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.value)}</td><td class="status-${r.status ?? "neutral"}">${r.status ?? "—"}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    </section>`;

  const sections = [
    report.summary,
    report.marketplace,
    report.downloads,
    report.engagement,
    report.notice,
  ]
    .filter(Boolean)
    .map((s) => sectionHtml(s!))
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(report.reportTitle)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1.5rem; color: #111; line-height: 1.5; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 2rem; }
    h2 { font-size: 1.1rem; margin: 1.5rem 0 0.75rem; border-bottom: 1px solid #ddd; padding-bottom: 0.35rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 1rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border: 1px solid #e5e5e5; }
    th { background: #f5f5f5; font-weight: 600; }
    .status-ok { color: #059669; }
    .status-warn { color: #d97706; }
    .status-danger { color: #dc2626; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.reportTitle)}</h1>
  <p class="meta">${escapeHtml(report.organization)} · ${escapeHtml(report.product)} · Generated ${new Date(report.generatedAt).toLocaleString()}</p>
  ${sections}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
