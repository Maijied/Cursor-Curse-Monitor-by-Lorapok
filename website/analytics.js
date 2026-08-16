/**
 * Anonymous visit + package link tracking for the marketing site.
 * Beacons to Lorapok Facility /api/analytics/visit (ADMIN_KV). No client Firestore writes.
 * Optional Google Analytics when a public measurement ID is configured.
 */
(function () {
  const SESSION_KEY = "ccm-analytics-session";
  const CHANNELS = {
    "[data-href-ovsx]": "ovsx",
    "[data-href-vscode]": "vscode",
    "[data-href-vsix]": "vsix",
    "[data-href-repo]": "github",
    "[data-href-release]": "github",
    "[data-href-npm]": "npm",
  };

  const DEFAULT_API = "https://cursor-dev.lorapok.tech";

  function sendBeacon(url, channel) {
    const payload = JSON.stringify({
      channel,
      path: window.location.pathname,
      referrer: document.referrer || null,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }

  function trackEvent(channel) {
    const url = window.__ccmBeaconUrl;
    if (!url) return;
    sendBeacon(url, channel);
  }

  function trackPageView() {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* private mode */
    }
    trackEvent("website");
  }

  function bindPackageClicks() {
    for (const [selector, channel] of Object.entries(CHANNELS)) {
      document.querySelectorAll(selector).forEach((el) => {
        el.addEventListener("click", () => trackEvent(channel));
      });
    }
  }

  function loadGtag(measurementId) {
    if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) return;
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", measurementId, { anonymize_ip: true });
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    document.head.appendChild(s);
  }

  async function init() {
    let social = null;
    let siteData = null;
    try {
      const [socialRes, siteRes] = await Promise.all([
        fetch("social.json", { cache: "no-store" }),
        fetch("site-data.json", { cache: "no-store" }),
      ]);
      if (socialRes.ok) social = await socialRes.json();
      if (siteRes.ok) siteData = await siteRes.json();
    } catch {
      /* ignore */
    }

    const apiBase = (social?.api?.base || DEFAULT_API).replace(/\/$/, "");
    window.__ccmBeaconUrl =
      social?.api?.analyticsVisit ||
      siteData?.analytics?.beaconUrl ||
      `${apiBase}/api/analytics/visit`;

    trackPageView();
    bindPackageClicks();

    const gaId =
      siteData?.analytics?.gaMeasurementId ||
      social?.analytics?.gaMeasurementId ||
      "";
    if (gaId) loadGtag(String(gaId).trim());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
