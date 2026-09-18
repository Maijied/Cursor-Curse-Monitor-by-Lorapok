/**
 * Chrysalis — floating AI assistant (CHRYS-01).
 * Brand + Larvae mascot; product context from site-data.json.
 * Keep larvae SVG in sync with packages/shared/src/chrysalis.ts (test_chrysalis_shell).
 */
(function () {
  const BRAND = {
    name: "Chrysalis",
    panelTitle: "Chrysalis · Lorapok product guide",
    toggleAria: "Open Chrysalis product guide",
    footer: "Local session — Chrysalis uses site-data only. AI chat (BYOK) coming soon.",
    offline: "Product data unavailable offline.",
  };

  function larvaeSvg(width) {
    const height = Math.round(width * 1.35);
    return `<svg width="${width}" height="${height}" viewBox="0 0 64 88" fill="none" xmlns="http://www.w3.org/2000/svg" class="larvae-loader-root ccm-chrysalis-larvae" aria-hidden="true">
      <ellipse class="larvae-trail" cx="32" cy="82" rx="18" ry="4" fill="#39ff14" opacity="0.2"></ellipse>
      <g class="larvae-leg-left"><path d="M22 72 L16 82 M28 76 L22 86" stroke="#5b9dff" stroke-width="2.2" stroke-linecap="round" opacity="0.75"></path></g>
      <g class="larvae-leg-right"><path d="M42 72 L48 82 M36 76 L42 86" stroke="#5b9dff" stroke-width="2.2" stroke-linecap="round" opacity="0.75"></path></g>
      <ellipse class="larvae-segment larvae-segment-3" cx="32" cy="62" rx="22" ry="14" fill="#2d3748" stroke="#4a5568" stroke-width="1"></ellipse>
      <ellipse class="larvae-segment larvae-segment-2" cx="32" cy="46" rx="19" ry="13" fill="#374151" stroke="#4a5568" stroke-width="1"></ellipse>
      <ellipse class="larvae-segment larvae-segment-1" cx="32" cy="32" rx="16" ry="12" fill="#3d4a5c" stroke="#5b9dff" stroke-width="0.8"></ellipse>
      <path d="M24 38 Q32 44 40 38" stroke="#39ff14" stroke-width="2.2" stroke-linecap="round" opacity="0.8"></path>
      <ellipse cx="26" cy="28" rx="7" ry="8" fill="#0a0e14" stroke="#39ff14" stroke-width="0.8"></ellipse>
      <ellipse cx="38" cy="28" rx="7" ry="8" fill="#0a0e14" stroke="#39ff14" stroke-width="0.8"></ellipse>
      <circle class="larvae-eye" cx="26" cy="28" r="4.5" fill="#39ff14"></circle>
      <circle class="larvae-eye larvae-eye-right" cx="38" cy="28" r="4.5" fill="#39ff14"></circle>
      <circle cx="24.5" cy="26.5" r="1.2" fill="white" opacity="0.9"></circle>
      <circle cx="36.5" cy="26.5" r="1.2" fill="white" opacity="0.9"></circle>
    </svg>`;
  }

  function mount() {
    if (document.getElementById("ccm-chrysalis") || document.getElementById("ccm-floating-ai")) return;

    const root = document.createElement("div");
    root.id = "ccm-chrysalis";
    root.className = "ccm-floating-ai ccm-chrysalis";
    root.setAttribute("data-chrysalis", "1");
    root.innerHTML = `
      <div class="ccm-floating-ai-panel" id="ccm-chrysalis-panel" hidden>
        <div class="ccm-floating-ai-header">${BRAND.panelTitle}</div>
        <div class="ccm-floating-ai-body" id="ccm-chrysalis-body">Loading…</div>
        <div class="ccm-floating-ai-footer">${BRAND.footer}</div>
      </div>
      <button type="button" class="ccm-floating-ai-toggle ccm-chrysalis-toggle" id="ccm-chrysalis-toggle" aria-expanded="false" aria-controls="ccm-chrysalis-panel" aria-label="${BRAND.toggleAria}">
        ${larvaeSvg(36)}
      </button>`;
    document.body.appendChild(root);

    const panel = root.querySelector("#ccm-chrysalis-panel");
    const toggle = root.querySelector("#ccm-chrysalis-toggle");
    const body = root.querySelector("#ccm-chrysalis-body");

    toggle.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    function render(data) {
      if (!data) {
        body.textContent = BRAND.offline;
        return;
      }
      const dl = data.downloads?.displayTotal ?? data.downloads?.total;
      const gc = data.githubCommunity;
      body.innerHTML = `
        <p><strong>${BRAND.name}</strong> stays synced from the latest <code>site-data.json</code> build.</p>
        <dl>
          <dt>Version</dt><dd>${data.version ?? "—"}</dd>
          <dt>Downloads</dt><dd>${dl != null ? Number(dl).toLocaleString() : "—"}</dd>
          <dt>Open VSX</dt><dd>${data.ovsx?.version ?? "—"}</dd>
          <dt>VS Code</dt><dd>${data.vscode?.version ?? "—"}</dd>
          <dt>GitHub issues</dt><dd>${gc?.openIssues ?? "—"}</dd>
          <dt>CI avg job</dt><dd>${gc?.ci?.avgJobRunSeconds != null ? gc.ci.avgJobRunSeconds + "s" : "—"}</dd>
        </dl>
        <p style="margin-top:0.75rem">${BRAND.name === "Chrysalis" ? "Want to contribute? " : ""}<a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">CONTRIBUTING</a> · <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22" target="_blank" rel="noopener">Good first issues</a> · <a href="https://github.com/users/Maijied/projects/4" target="_blank" rel="noopener">Project #4 →</a></p>`;
    }

    if (window.__CCM_SITE_DATA__) render(window.__CCM_SITE_DATA__);
    document.addEventListener("ccm:site-data", (e) => render(e.detail));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
