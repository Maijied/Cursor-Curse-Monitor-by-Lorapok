/** @typedef {{ label: string; value: number; color: string; inTotal?: boolean }} ReadmeStatBar */

export function isVerifiedDownloadStats(data) {
  return data?.downloads?.verified === true;
}

export function renderShieldsBadgeUnavailable(label = "downloads") {
  return {
    schemaVersion: 1,
    label,
    message: "unavailable",
    color: "lightgrey",
  };
}

export function formatCount(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString("en-US");
}

/**
 * @param {Record<string, unknown>} data site-data.json payload
 */
export function buildReadmeStatsFromSiteData(data) {
  const verified = isVerifiedDownloadStats(data);
  const breakdown = /** @type {Record<string, number | null>} */ (data?.downloads?.breakdown ?? {});
  const total = verified ? Number(data?.downloads?.total ?? data?.downloads?.displayTotal) : null;
  const openVsxCombined = verified ? Number(data?.downloads?.openVsxCombined) : null;
  const canonical = breakdown.openVsxCanonical ?? data?.ovsx?.downloadCount ?? null;
  const legacy = breakdown.openVsxDuplicate ?? data?.ovsxDuplicate?.downloadCount ?? null;
  const vscode = breakdown.vscodeMarketplace ?? data?.vscode?.downloadCount ?? null;
  const github = breakdown.githubAllAssets ?? data?.github?.totalReleaseDownloads ?? null;

  /** @type {ReadmeStatBar[]} */
  const bars = [
    { label: "Open VSX (canonical)", value: canonical ?? 0, color: "#7c5cff", inTotal: true },
    { label: "Open VSX (LorapokLabs)", value: legacy ?? 0, color: "#94a3b8", inTotal: true },
    { label: "VS Code Marketplace", value: vscode ?? 0, color: "#4d9fff", inTotal: true },
    { label: "GitHub releases", value: github ?? 0, color: "#34d399", inTotal: true },
  ].filter((bar, index) => {
    if (!verified) return false;
    if (index === 1 && legacy == null) return false;
    if (index === 2 && vscode == null) return false;
    return bar.value != null;
  });

  return {
    verified,
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
  if (!stats.verified) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="120" viewBox="0 0 720 120" role="img" aria-label="Download stats unavailable">
  <rect width="720" height="120" rx="16" fill="#0b1020" stroke="rgba(148,163,184,0.35)"/>
  <text x="360" y="52" text-anchor="middle" fill="#f8fafc" font-size="18" font-weight="700" font-family="Segoe UI, system-ui, sans-serif">Community downloads unavailable</text>
  <text x="360" y="78" text-anchor="middle" fill="#94a3b8" font-size="12" font-family="Segoe UI, system-ui, sans-serif">Live marketplace sources did not respond — no placeholder counts shown</text>
</svg>`;
  }

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
  <text x="${width - pad}" y="34" text-anchor="end" fill="#94a3b8" font-size="11" font-family="Segoe UI, system-ui, sans-serif">synced</text>
  <line x1="${pad}" y1="${chartTop + chartHeight + 28}" x2="${width - pad}" y2="${chartTop + chartHeight + 28}" stroke="rgba(148,163,184,0.18)"/>
  ${barsSvg}
  <text x="${pad}" y="${height - 14}" fill="#64748b" font-size="10" font-family="Segoe UI, system-ui, sans-serif">Updated ${escapeXml(updated)} · grand total across Open VSX (both namespaces), VS Code Marketplace, and GitHub releases</text>
</svg>`;
}

/**
 * Shields.io endpoint JSON for dynamic README badges.
 * @param {ReturnType<typeof buildReadmeStatsFromSiteData>} stats
 * @param {"total"|"openvsx"|"openvsx-total"|"vscode"} kind
 */
export function renderShieldsBadge(stats, kind = "total") {
  if (!stats.verified) {
    const labels = {
      total: "downloads",
      openvsx: "Open VSX",
      "openvsx-total": "Open VSX total",
      vscode: "VS Code",
    };
    return renderShieldsBadgeUnavailable(labels[kind] ?? "downloads");
  }

  const map = {
    total: { label: "downloads", message: `${formatCount(stats.total)} total`, color: "6C5CE7" },
    openvsx: { label: "Open VSX", message: formatCount(stats.canonical), color: "7C5CFF" },
    "openvsx-total": {
      label: "Open VSX total",
      message: formatCount(stats.openVsxCombined),
      color: "5B4BDB",
    },
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
