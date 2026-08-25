/** @typedef {{ label: string; value: number; color: string; inTotal?: boolean }} ReadmeStatBar */

export function formatCount(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString("en-US");
}

/**
 * @param {Record<string, unknown>} data site-data.json payload
 */
export function buildReadmeStatsFromSiteData(data) {
  const breakdown = /** @type {Record<string, number>} */ (data?.downloads?.breakdown ?? {});
  const total = Number(data?.downloads?.total ?? data?.downloads?.displayTotal ?? 0);
  const openVsxCombined = Number(
    data?.downloads?.openVsxCombined ??
      (breakdown.openVsxCanonical ?? 0) + (breakdown.openVsxDuplicate ?? 0),
  );
  const canonical = breakdown.openVsxCanonical ?? data?.ovsx?.downloadCount ?? 0;
  const legacy = breakdown.openVsxDuplicate ?? data?.ovsxDuplicate?.downloadCount ?? 0;
  const vscode = breakdown.vscodeMarketplace ?? data?.vscode?.downloadCount ?? 0;
  const github = breakdown.githubAllAssets ?? data?.github?.totalReleaseDownloads ?? 0;

  /** @type {ReadmeStatBar[]} */
  const bars = [
    { label: "Open VSX (canonical)", value: canonical, color: "#7c5cff", inTotal: true },
    { label: "VS Code Marketplace", value: vscode, color: "#4d9fff", inTotal: true },
    { label: "GitHub releases", value: github, color: "#34d399", inTotal: true },
    { label: "Open VSX (LorapokLabs)", value: legacy, color: "#94a3b8", inTotal: false },
  ];

  return {
    total,
    openVsxCombined,
    canonical,
    legacy,
    vscode,
    github,
    version: String(data?.packageVersion ?? data?.version ?? "—"),
    generatedAt: String(data?.generatedAt ?? new Date().toISOString()),
    bars,
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {ReturnType<typeof buildReadmeStatsFromSiteData>} stats
 */
export function renderReadmeStatsSvg(stats) {
  const width = 720;
  const height = 220;
  const pad = 24;
  const chartTop = 78;
  const chartHeight = 96;
  const maxValue = Math.max(...stats.bars.map((b) => b.value), 1);
  const barGap = 14;
  const barWidth = (width - pad * 2 - barGap * (stats.bars.length - 1)) / stats.bars.length;
  const updated = new Date(stats.generatedAt).toUTCString();

  const barsSvg = stats.bars
    .map((bar, index) => {
      const x = pad + index * (barWidth + barGap);
      const h = Math.max(6, Math.round((bar.value / maxValue) * chartHeight));
      const y = chartTop + chartHeight - h;
      const opacity = bar.inTotal === false ? 0.55 : 1;
      const dash = bar.inTotal === false ? ' stroke="#64748b" stroke-width="1" stroke-dasharray="4 3"' : "";
      return `
  <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="8" fill="${bar.color}" opacity="${opacity}"${dash}/>
  <text x="${x + barWidth / 2}" y="${chartTop + chartHeight + 18}" text-anchor="middle" fill="#cbd5e1" font-size="11" font-family="Segoe UI, system-ui, sans-serif">${escapeXml(bar.label)}</text>
  <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" fill="#f8fafc" font-size="12" font-weight="700" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(formatCount(bar.value))}</text>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Cursor Curse Monitor download stats">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1020"/>
      <stop offset="100%" stop-color="#06080d"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="16" fill="url(#bg)" stroke="rgba(124,92,255,0.35)"/>
  <text x="${pad}" y="34" fill="#f8fafc" font-size="18" font-weight="700" font-family="Segoe UI, system-ui, sans-serif">Community downloads</text>
  <text x="${pad}" y="54" fill="#94a3b8" font-size="12" font-family="Segoe UI, system-ui, sans-serif">Total ${escapeXml(formatCount(stats.total))} · Open VSX ${escapeXml(formatCount(stats.openVsxCombined))} · v${escapeXml(stats.version)}</text>
  <text x="${width - pad}" y="34" text-anchor="end" fill="#34d399" font-size="11" font-family="Segoe UI, system-ui, sans-serif">● live</text>
  <line x1="${pad}" y1="${chartTop + chartHeight + 28}" x2="${width - pad}" y2="${chartTop + chartHeight + 28}" stroke="rgba(148,163,184,0.18)"/>
  ${barsSvg}
  <text x="${pad}" y="${height - 14}" fill="#64748b" font-size="10" font-family="Segoe UI, system-ui, sans-serif">Updated ${escapeXml(updated)} · canonical total excludes LorapokLabs legacy namespace</text>
</svg>`;
}

/**
 * Shields.io endpoint JSON for dynamic README badges.
 * @param {ReturnType<typeof buildReadmeStatsFromSiteData>} stats
 * @param {"total"|"openvsx"|"openvsx-total"|"vscode"} kind
 */
export function renderShieldsBadge(stats, kind = "total") {
  const map = {
    total: { label: "downloads", message: `${formatCount(stats.total)} total`, color: "6C5CE7" },
    openvsx: { label: "Open VSX", message: formatCount(stats.canonical), color: "7C5CFF" },
    "openvsx-total": { label: "Open VSX total", message: formatCount(stats.openVsxCombined), color: "5B4BDB" },
    vscode: { label: "VS Code", message: formatCount(stats.vscode), color: "007ACC" },
  };
  const entry = map[kind] ?? map.total;
  return {
    schemaVersion: 1,
    label: entry.label,
    message: entry.message,
    color: entry.color,
  };
}
