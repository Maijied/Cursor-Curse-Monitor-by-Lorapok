/**
 * Floating AI panel — live product info from site-data.json (no server chat log).
 */
(function () {
  function mount() {
    if (document.getElementById("ccm-floating-ai")) return;

    const root = document.createElement("div");
    root.id = "ccm-floating-ai";
    root.className = "ccm-floating-ai";
    root.innerHTML = `
      <div class="ccm-floating-ai-panel" id="ccm-floating-ai-panel" hidden>
        <div class="ccm-floating-ai-header">Lorapok guide · live product info</div>
        <div class="ccm-floating-ai-body" id="ccm-floating-ai-body">Loading…</div>
        <div class="ccm-floating-ai-footer">Local session only — no chat sent to servers. Data from site-data.json.</div>
      </div>
      <button type="button" class="ccm-floating-ai-toggle" id="ccm-floating-ai-toggle" aria-expanded="false" aria-controls="ccm-floating-ai-panel" aria-label="Open Lorapok product guide">
        <img src="assets/logo.svg" alt="" width="36" height="36" />
      </button>`;
    document.body.appendChild(root);

    const panel = root.querySelector("#ccm-floating-ai-panel");
    const toggle = root.querySelector("#ccm-floating-ai-toggle");
    const body = root.querySelector("#ccm-floating-ai-body");

    toggle.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    function render(data) {
      if (!data) {
        body.textContent = "Product data unavailable offline.";
        return;
      }
      const dl = data.downloads?.displayTotal ?? data.downloads?.total;
      const gc = data.githubCommunity;
      body.innerHTML = `
        <p>Always synced from the latest <code>site-data.json</code> build.</p>
        <dl>
          <dt>Version</dt><dd>${data.version ?? "—"}</dd>
          <dt>Downloads</dt><dd>${dl != null ? Number(dl).toLocaleString() : "—"}</dd>
          <dt>Open VSX</dt><dd>${data.ovsx?.version ?? "—"}</dd>
          <dt>VS Code</dt><dd>${data.vscode?.version ?? "—"}</dd>
          <dt>GitHub issues</dt><dd>${gc?.openIssues ?? "—"}</dd>
          <dt>CI avg job</dt><dd>${gc?.ci?.avgJobRunSeconds != null ? gc.ci.avgJobRunSeconds + "s" : "—"}</dd>
        </dl>
        <p style="margin-top:0.75rem"><a href="https://github.com/users/Maijied/projects/4" target="_blank" rel="noopener">View public task board →</a></p>`;
    }

    if (window.__CCM_SITE_DATA__) render(window.__CCM_SITE_DATA__);
    document.addEventListener("ccm:site-data", (e) => render(e.detail));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
