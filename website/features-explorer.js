/**
 * Interactive feature orbit map + GitHub community stats (synced via site.js).
 */
(function () {
  const LOGO_SRC = "assets/logo.svg";
  const FEATURES = [
    {
      id: "usage",
      title: "Live usage dashboard",
      short: "Quota & billing",
      summary: "Quota, billing cycle, budget caps, and Composer 2.5 fallback in every VS Code AI IDE.",
      detail:
        "Tracks included limits, on-demand spend, and auto-switches to free slow-pool mode when limits hit — local-first, no cloud telemetry required.",
      icon: "assets/monitor-dashboard.svg",
      angle: 0,
    },
    {
      id: "security",
      title: "Credential scanner",
      short: "Secrets guard",
      summary: "Local scanSecrets guard for API keys before they leave your machine.",
      detail: "IDE, browser paste guard, and pre-commit hooks share the same Lorapok scanner patterns.",
      icon: "assets/security-shield.svg",
      angle: 60,
    },
    {
      id: "browser",
      title: "Browser extension",
      short: "Firefox + Chrome",
      summary: "Firefox AMO + Chrome zip — budget popup and cursor.com token capture.",
      detail: "Roadmap: Safari, Edge, Opera, Brave (ECO-01) with unified shared package.",
      icon: "assets/api-connect.svg",
      angle: 120,
    },
    {
      id: "admin",
      title: "Mission Control",
      short: "Ops panel",
      summary: "Deployments, mail, notices, marketplace sync, and RBAC admin.",
      detail: "Public Project #4 tracks delivery. Operators use confirmAction before destructive deploys.",
      icon: "assets/team-usage.svg",
      angle: 180,
    },
    {
      id: "ai",
      title: "Floating AI guide",
      short: "Larvae assistant",
      summary: "Always up to date from site-data — version, downloads, channels.",
      detail: "Ask the Lorapok Larvae assistant (bottom-right). No server chat log without opt-in.",
      icon: "assets/welcome-animation.svg",
      angle: 240,
    },
    {
      id: "notify",
      title: "Push alerts",
      short: "Roadmap",
      summary: "Browser + OS notifications for quota warnings and admin notices.",
      detail: "ECO-07: Web Push + native tray notifications when limits or Mission Control notices fire.",
      icon: "assets/notification-warning.svg",
      angle: 300,
    },
  ];

  let activeId = FEATURES[0]?.id ?? null;
  const orbitRadius = 132;

  function formatCount(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return Number(n).toLocaleString();
  }

  function renderDetail(feature) {
    const detail = document.getElementById("feature-detail");
    if (!detail || !feature) return;
    detail.innerHTML = `
      <div class="feature-detail-head">
        <img class="feature-detail-icon" src="${feature.icon}" alt="" width="40" height="40" />
        <div>
          <p class="feature-detail-eyebrow">${feature.short}</p>
          <h3>${feature.title}</h3>
        </div>
      </div>
      <p class="feature-detail-summary">${feature.summary}</p>
      <p class="feature-detail-body">${feature.detail}</p>`;
  }

  function selectFeature(id) {
    const feature = FEATURES.find((f) => f.id === id);
    if (!feature) return;
    activeId = id;
    document.querySelectorAll(".feature-map-node").forEach((node) => {
      const on = node.dataset.featureId === id;
      node.classList.toggle("is-active", on);
      node.setAttribute("aria-selected", on ? "true" : "false");
    });
    const orbit = document.getElementById("feature-map-orbit");
    if (orbit) orbit.dataset.activeFeature = id;
    renderDetail(feature);
  }

  function initFeatureMap() {
    const nodesEl = document.getElementById("feature-map-nodes");
    if (!nodesEl) return;

    FEATURES.forEach((f, i) => {
      const rad = (f.angle * Math.PI) / 180;
      const x = Math.cos(rad) * orbitRadius;
      const y = Math.sin(rad) * orbitRadius;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "feature-map-node" + (i === 0 ? " is-active" : "");
      btn.dataset.featureId = f.id;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
      btn.setAttribute("aria-label", f.title);
      btn.style.setProperty("--node-x", `${x}px`);
      btn.style.setProperty("--node-y", `${y}px`);
      btn.style.setProperty("--node-delay", `${i * 0.35}s`);
      btn.innerHTML = `
        <span class="feature-map-node-orbit" aria-hidden="true"></span>
        <img src="${f.icon}" alt="" width="28" height="28" />
        <span class="feature-map-node-label">${f.short}</span>`;
      btn.addEventListener("click", () => selectFeature(f.id));
      nodesEl.appendChild(btn);
    });

    if (FEATURES[0]) selectFeature(FEATURES[0].id);
  }

  function renderCommunityStats(gc) {
    const el = document.getElementById("github-community-stats");
    if (!el || !gc) return;

    const repoUrl = gc.repositoryUrl ?? "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok";
    const boardIssues = gc.openIssues ?? gc.project?.openIssues;
    const githubOpen = gc.openIssuesGitHub;
    const stars = gc.stars;
    const starCell =
      stars != null && stars > 0
        ? `<div class="github-stat"><strong>${formatCount(stars)}</strong><span>GitHub stars</span></div>`
        : `<div class="github-stat github-stat--cta">
            <a class="github-star-cta" href="${repoUrl}" target="_blank" rel="noopener">★ Star on GitHub</a>
            <span>Help others discover CCM</span>
          </div>`;

    const issueNote =
      githubOpen != null && boardIssues != null && githubOpen !== boardIssues
        ? `<span class="github-stat-note">${formatCount(githubOpen)} total on GitHub (incl. PRs)</span>`
        : "";

    const t = gc.traffic ?? {};
    el.innerHTML = `
      <div class="github-community-grid">
        <div class="github-stat"><strong>${formatCount(t.clones?.total)}</strong><span>Git clones (14d)</span></div>
        <div class="github-stat"><strong>${formatCount(t.views?.total)}</strong><span>Repo views (14d)</span></div>
        <div class="github-stat">
          <strong>${formatCount(boardIssues)}</strong>
          <span>Board issues</span>
          ${issueNote}
        </div>
        <div class="github-stat"><strong>${gc.ci?.avgJobRunSeconds ?? "—"}s</strong><span>CI avg job time</span></div>
        <div class="github-stat"><strong>${gc.ci?.jobFailureRatePercent ?? "—"}%</strong><span>CI failure rate</span></div>
        ${starCell}
      </div>
      <p class="github-community-foot muted">
        <a href="${gc.project?.url ?? "https://github.com/users/Maijied/projects/4"}" target="_blank" rel="noopener">Public planning board</a>
        · updated ${gc.lastUpdated ?? "—"}
      </p>`;
  }

  function applySiteData(data) {
    if (!data) return;
    renderCommunityStats(data.githubCommunity);
  }

  function boot() {
    initFeatureMap();
    if (window.__CCM_SITE_DATA__) {
      applySiteData(window.__CCM_SITE_DATA__);
    }
    document.addEventListener("ccm:site-data", (e) => {
      applySiteData(e.detail);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
