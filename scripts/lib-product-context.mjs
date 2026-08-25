/**
 * Shared product URLs and version context for notices, mail, and site-data.
 */
const DEFAULT_REPO = "Maijied/Cursor-Curse-Monitor-by-Lorapok";

export function buildProductContext(pkg = {}) {
  const version = String(pkg.version ?? "1.0.3").replace(/^v/, "");
  const repo =
    pkg.repository?.url?.match(/github\.com\/([^/]+\/[^/.]+)/)?.[1] ?? DEFAULT_REPO;
  const homepage = (pkg.homepage ?? "https://cursor.lorapok.tech/").replace(/\/$/, "");

  return {
    version,
    displayName: pkg.displayName ?? "Cursor Curse Monitor by Lorapok",
    homepage,
    adminUrl: pkg.company?.adminUrl ?? "https://cursor-dev.lorapok.tech",
    supportEmail: pkg.company?.supportEmail ?? "cursor.curse.help@lorapok.tech",
    productEmail: pkg.company?.productEmail ?? "cursor.monitor@lorapok.tech",
    website: pkg.company?.website ?? "https://lorapok.tech",
    feedbackUrl: `https://github.com/${repo}/issues`,
    collaborateUrl: `https://github.com/${repo}/discussions`,
    releaseUrl: `https://github.com/${repo}/releases/tag/v${version}`,
    latestReleaseUrl: `https://github.com/${repo}/releases/latest`,
    firefoxUrl: "https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor/",
    ovsxUrl: "https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok",
    vscodeUrl:
      "https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok",
    repo,
  };
}
