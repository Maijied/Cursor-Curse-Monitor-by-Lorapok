/**
 * Anonymous visit + package link tracking for the marketing site.
 * Persists to Firestore (production) and beacons to /api/analytics/visit (dev snapshot).
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

  let firestoreReady = false;
  let db = null;

  async function initFirestore() {
    if (firestoreReady) return db;
    try {
      const [configRes, appMod, fsMod] = await Promise.all([
        fetch("firebase-public.json"),
        import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js"),
      ]);
      if (!configRes.ok) return null;
      const config = await configRes.json();
      const app = appMod.initializeApp(config);
      db = fsMod.getFirestore(app);
      firestoreReady = true;
      return { db, fsMod };
    } catch {
      return null;
    }
  }

  function getBeaconUrl(data) {
    const path = data?.analytics?.beaconPath || "/api/analytics/visit";
    try {
      return new URL(path, window.location.origin).href;
    } catch {
      return path;
    }
  }

  function sendBeacon(channel) {
    const payload = JSON.stringify({
      channel,
      path: window.location.pathname,
      referrer: document.referrer || null,
    });
    const url = window.__ccmBeaconUrl || "/api/analytics/visit";
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
    }
  }

  async function trackEvent(channel) {
    sendBeacon(channel);
    const fs = await initFirestore();
    if (!fs) return;
    const { db: firestore, fsMod } = fs;
    const ref = fsMod.doc(firestore, "stats", "visitors");
    const field = channel === "website" ? "websiteVisits" : `packageClicks.${channel}`;
    try {
      await fsMod.updateDoc(ref, {
        [field]: fsMod.increment(1),
        totalEngagement: fsMod.increment(1),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      try {
        await fsMod.setDoc(ref, {
          websiteVisits: channel === "website" ? 1 : 0,
          packageClicks: { ovsx: 0, vscode: 0, github: 0, vsix: 0, npm: 0, openvsxDuplicate: 0, [channel]: channel === "website" ? 0 : 1 },
          totalEngagement: 1,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch {
        /* Firestore rules may block anonymous writes until configured */
      }
    }
  }

  function trackPageView() {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    trackEvent("website");
  }

  function bindPackageClicks() {
    for (const [selector, channel] of Object.entries(CHANNELS)) {
      document.querySelectorAll(selector).forEach((el) => {
        el.addEventListener("click", () => trackEvent(channel));
      });
    }
  }

  async function init() {
    let data = null;
    try {
      const res = await fetch("site-data.json", { cache: "no-store" });
      if (res.ok) data = await res.json();
    } catch {
      /* ignore */
    }
    window.__ccmBeaconUrl = getBeaconUrl(data);
    trackPageView();
    bindPackageClicks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
