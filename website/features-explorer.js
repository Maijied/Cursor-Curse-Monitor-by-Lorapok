/**
 * Post-hero interactive feature cards + GitHub community stats panel.
 */
(function () {
  const FEATURES = [
    {
      id: "usage",
      title: "Live usage dashboard",
      summary: "Quota, billing cycle, budget caps, and Composer 2.5 fallback in every VS Code AI IDE.",
      detail:
        "Tracks included limits, on-demand spend, and auto-switches to free slow-pool mode when limits hit — local-first, no cloud telemetry required.",
    },
    {
      id: "security",
      title: "Credential scanner",
      summary: "Local scanSecrets guard for API keys before they leave your machine.",
      detail: "IDE, browser paste guard, and pre-commit hooks share the same Lorapok scanner patterns.",
    },
    {
      id: "browser",
      title: "Browser extension",
      summary: "Firefox AMO + Chrome zip — budget popup and cursor.com token capture.",
      detail: "Roadmap: Safari, Edge, Opera, Brave (ECO-01) with unified shared package.",
    },
    {
      id: "admin",
      title: "Mission Control",
      summary: "Deployments, mail, notices, marketplace sync, and RBAC admin.",
      detail: "43+ tracked issues on public Project #4. Operators use confirmAction before destructive deploys.",
    },
    {
      id: "ai",
      title: "Floating AI guide",
      summary: "Always up to date from site-data.json — version, downloads, channels.",
      detail: "Ask the Lorapok Larvae assistant (bottom-right). No server chat log without opt-in.",
    },
    {
      id: "notify",
      title: "Push alerts (roadmap)",
      summary: "Browser + OS notifications for quota warnings and admin notices.",
      detail: "ECO-07: Web Push + native tray notifications when limits or Mission Control notices fire.",
    },
  ];

  function formatCount(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return Number(n).toLocaleString();
  }

  function renderCommunityStats(gc) {
    const el = document.getElementById("github-community-stats");
    if (!el || !gc) return;
    const t = gc.traffic ?? {};
    el.innerHTML = `
      <div class="github-community-grid">
        <div class="github-stat"><strong>${formatCount(t.clones?.total)}</strong><span>Git clones (14d)</span></div>
        <div class="github-stat"><strong>${formatCount(t.views?.total)}</strong><span>Repo views (14d)</span></div>
        <div class="github-stat"><strong>${formatCount(gc.openIssues)}</strong><span>Open issues</span></div>
        <div class="github-stat"><strong>${gc.ci?.avgJobRunSeconds ?? "—"}s</strong><span>CI avg job time</span></div>
        <div class="github-stat"><strong>${gc.ci?.jobFailureRatePercent ?? "—"}%</strong><span>CI failure rate</span></div>
        <div class="github-stat"><strong>${formatCount(gc.stars)}</strong><span>GitHub stars</span></div>
      </div>
      <p class="muted" style="margin-top:0.75rem;font-size:0.85rem">
        <a href="${gc.project?.url ?? "https://github.com/users/Maijied/projects/4"}" target="_blank" rel="noopener">Public planning board</a>
        · updated ${gc.lastUpdated ?? "—"}
      </p>`;
  }

  function initFeatures() {
    const grid = document.getElementById("features-explorer-grid");
    const detail = document.getElementById("feature-detail");
    if (!grid || !detail) return;

    FEATURES.forEach((f, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "feature-card" + (i === 0 ? " is-active" : "");
      btn.dataset.featureId = f.id;
      btn.innerHTML = `<h3>${f.title}</h3><p>${f.summary}</p>`;
      btn.addEventListener("click", () => {
        grid.querySelectorAll(".feature-card").forEach((c) => c.classList.remove("is-active"));
        btn.classList.add("is-active");
        detail.innerHTML = `<h3>${f.title}</h3><p>${f.detail}</p>`;
      });
      grid.appendChild(btn);
    });
    if (FEATURES[0]) {
      detail.innerHTML = `<h3>${FEATURES[0].title}</h3><p>${FEATURES[0].detail}</p>`;
    }
  }

  async function loadSiteData() {
    try {
      const res = await fetch("/site-data.json", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      renderCommunityStats(data.githubCommunity);
      window.__CCM_SITE_DATA__ = data;
      document.dispatchEvent(new CustomEvent("ccm:site-data", { detail: data }));
    } catch {
      /* offline / file:// */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initFeatures();
      loadSiteData();
    });
  } else {
    initFeatures();
    loadSiteData();
  }
})();
