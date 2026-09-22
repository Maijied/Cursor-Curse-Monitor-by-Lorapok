/**
 * Google AdSense Auto ads — consent-gated loader (WEB-12).
 * Loads only after LEGAL-01 process consent grants analytics/marketing.
 */
(function () {
  const CLIENT = "ca-pub-3756651399602872";
  const LOADED_KEY = "__ccmAdsenseLoaded";

  function gtag() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }

  function setConsentDefaults() {
    window.gtag = window.gtag || gtag;
    gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      wait_for_update: 500,
    });
  }

  function grantConsentMode() {
    gtag("consent", "update", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
    });
  }

  function loadAdSense() {
    if (window[LOADED_KEY]) return;
    window[LOADED_KEY] = true;
    grantConsentMode();
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  }

  function maybeLoad() {
    const stored = window.__CCM_PROCESS_CONSENT__ || window.CCM_PROCESS_CONSENT?.get?.();
    if (stored?.analytics === true) {
      loadAdSense();
      return;
    }
    document.addEventListener("ccm:consent-analytics", () => loadAdSense(), { once: true });
  }

  setConsentDefaults();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", maybeLoad);
  } else {
    maybeLoad();
  }
})();
