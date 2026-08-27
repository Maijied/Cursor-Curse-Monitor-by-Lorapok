/** VS Code Marketplace gallery flags that return extension statistics. */
export const VSCE_GALLERY_FLAGS = 0x1 | 0x2 | 0x10 | 0x100; // Versions + Files + Statistics + LatestVersionOnly

/**
 * Prefer cumulative downloadCount (updates on each version publish) over unique install count.
 * @param {Record<string, number>} stats
 */
export function parseVsceDownloadCount(stats) {
  const downloadCount = Math.round(Number(stats.downloadCount ?? 0));
  if (downloadCount > 0) return downloadCount;
  return Math.round(Number(stats.install ?? stats.averagedownloadcount ?? 0));
}

/**
 * @param {string} extensionId e.g. LorapokLabs.cursor-curse-monitor-by-lorapok
 */
export async function fetchVsceExtension(extensionId) {
  const body = {
    filters: [{ criteria: [{ filterType: 7, value: extensionId }], pageSize: 1, pageNumber: 1 }],
    flags: VSCE_GALLERY_FLAGS,
  };
  try {
    const res = await fetch("https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json;api-version=6.1-preview.1",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const ext = json?.results?.[0]?.extensions?.[0];
    if (!ext) return null;
    const stats = {};
    for (const s of ext.statistics ?? []) {
      stats[s.statisticName] = s.value;
    }
    return {
      version: ext.versions?.[0]?.version ?? null,
      downloadCount: parseVsceDownloadCount(stats),
      installCount: Math.round(Number(stats.install ?? 0)),
      updateCount: Math.round(Number(stats.updateCount ?? 0)),
      statistics: stats,
    };
  } catch {
    return null;
  }
}
