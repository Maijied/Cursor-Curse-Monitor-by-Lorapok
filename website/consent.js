/**
 * LEGAL-01 — process consent banner (analytics / anonymous site metrics).
 * Fail closed: analytics.js waits for ccm:consent-analytics before beacons.
 */
(function () {
  const STORAGE_KEY = "ccm-process-consent";
  const VERSION = "2026-09-18";
  const BANNER_ID = "ccm-consent-banner";

  function readStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION) return null;
      if (parsed.analytics !== true && parsed.analytics !== false) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeStored(analytics) {
    const payload = {
      version: VERSION,
      analytics: Boolean(analytics),
      decidedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* private mode */
    }
    return payload;
  }

  function consentApiUrl() {
    const configured = window.__CCM_CONSENT_API__;
    if (configured) return configured;
    if (/lorapok\.tech$/i.test(location.hostname) || /github\.io$/i.test(location.hostname)) {
      return "https://cursor-dev.lorapok.tech/api/consent";
    }
    return "/api/consent";
  }

  function audit(choice) {
    const body = JSON.stringify({
      choice,
      version: VERSION,
      path: location.pathname,
    });
    const url = consentApiUrl();
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        return;
      }
    } catch {
      /* fall through */
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      mode: "cors",
    }).catch(() => {});
  }

  function allowAnalytics() {
    document.dispatchEvent(new CustomEvent("ccm:consent-analytics", { detail: { version: VERSION } }));
  }

  function hideBanner() {
    const node = document.getElementById(BANNER_ID);
    if (node) node.remove();
  }

  function decide(allow) {
    const stored = writeStored(allow);
    window.__CCM_PROCESS_CONSENT__ = stored;
    audit(allow ? "analytics_accept" : "analytics_decline");
    hideBanner();
    if (allow) allowAnalytics();
  }

  function renderBanner() {
    if (document.getElementById(BANNER_ID)) return;
    const bar = document.createElement("div");
    bar.id = BANNER_ID;
    bar.className = "ccm-consent-banner";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Privacy and analytics consent");
    bar.innerHTML = `
      <div class="ccm-consent-banner-inner">
        <p class="ccm-consent-copy">
          We use <strong>anonymous</strong> visit and download-click counts to improve Cursor Curse Monitor,
          and may show Google AdSense ads after you opt in. Extension usage stays on your machine.
          Chrysalis (floating guide) uses public site-data only until you add your own API key (BYOK).
          See <a href="${relativeLegal("privacy.html")}">Privacy</a> and <a href="${relativeLegal("terms.html")}">Terms</a>.
        </p>
        <div class="ccm-consent-actions">
          <button type="button" class="ccm-consent-btn ccm-consent-btn--ghost" data-consent="decline">Essential only</button>
          <button type="button" class="ccm-consent-btn ccm-consent-btn--primary" data-consent="accept">Allow analytics</button>
        </div>
      </div>`;
    document.body.appendChild(bar);
    bar.querySelector('[data-consent="accept"]')?.addEventListener("click", () => decide(true));
    bar.querySelector('[data-consent="decline"]')?.addEventListener("click", () => decide(false));
  }

  function relativeLegal(file) {
    const path = location.pathname.replace(/\\/g, "/");
    if (path.includes("/wiki/") || path.includes("/docs/")) return `../${file}`;
    return file;
  }

  window.CCM_PROCESS_CONSENT = {
    version: VERSION,
    get: readStored,
    allowAnalytics,
  };

  function boot() {
    const stored = readStored();
    window.__CCM_PROCESS_CONSENT__ = stored;
    if (stored?.analytics === true) {
      allowAnalytics();
      return;
    }
    if (stored?.analytics === false) {
      return;
    }
    renderBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
