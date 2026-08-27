/**
 * Animated live stats for hero dashboard — wired from site-data.json via site.js
 */
(function () {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function animateValue(el, end, duration) {
    if (!el || end == null || Number.isNaN(Number(end))) return;
    const target = Number(end);
    if (reducedMotion || duration <= 0) {
      el.textContent = target.toLocaleString();
      return;
    }
    const start = 0;
    const startTime = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(start + (target - start) * eased).toLocaleString();
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function setBar(el, pct) {
    if (!(el instanceof HTMLElement)) return;
    const width = `${Math.max(0, Math.min(100, pct))}%`;
    if (reducedMotion) {
      el.style.width = width;
      return;
    }
    requestAnimationFrame(() => {
      el.style.width = width;
    });
  }

  /**
   * @param {Record<string, unknown>} data site-data.json payload
   * @param {{ verified?: boolean }} [options]
   */
  function renderHeroStats(data, options = {}) {
    const root = document.getElementById("hero-stats-dashboard");
    if (!root || !data) return;

    const verified = options.verified === true;
    if (!verified) {
      root.querySelectorAll("[data-hero-downloads], [data-hero-ovsx-combined], [data-hero-ovsx-canonical], [data-hero-ovsx-duplicate]").forEach((el) => {
        el.textContent = "—";
      });
      root.classList.add("is-loaded");
      return;
    }

    const downloads = Number(data.downloads?.displayTotal ?? data.downloads?.total ?? 0);
    const visits = Number(data.visitors?.websiteVisits ?? 0);
    const engagement = Number(data.visitors?.totalEngagement ?? 0);
    const canonical = Number(
      data.downloads?.breakdown?.openVsxCanonical ?? data.ovsx?.downloadCount ?? 0
    );
    const duplicate = Number(
      data.downloads?.breakdown?.openVsxDuplicate ?? data.ovsxDuplicate?.downloadCount ?? 0
    );
    const combined = Number(data.downloads?.openVsxCombined ?? canonical + duplicate);

    const maxScale = Math.max(downloads, visits, engagement, combined, 1);

    animateValue(root.querySelector("[data-hero-downloads]"), downloads, 1200);
    animateValue(root.querySelector("[data-hero-visits]"), visits, 1200);
    animateValue(root.querySelector("[data-hero-engagement]"), engagement, 1200);
    animateValue(root.querySelector("[data-hero-ovsx-combined]"), combined, 1400);
    animateValue(root.querySelector("[data-hero-ovsx-canonical]"), canonical, 1000);
    animateValue(root.querySelector("[data-hero-ovsx-duplicate]"), duplicate, 1000);

    setBar(root.querySelector("[data-hero-downloads-bar]"), (downloads / maxScale) * 100);
    setBar(root.querySelector("[data-hero-visits-bar]"), (visits / maxScale) * 100);
    setBar(root.querySelector("[data-hero-engagement-bar]"), (engagement / maxScale) * 100);
    setBar(root.querySelector("[data-hero-ovsx-bar]"), combined > 0 ? 100 : 0);

    if (combined > 0) {
      const canonicalPct = Math.round((canonical / combined) * 100);
      const duplicatePct = 100 - canonicalPct;
      setBar(root.querySelector("[data-hero-ovsx-canonical-bar]"), canonicalPct);
      setBar(root.querySelector("[data-hero-ovsx-duplicate-bar]"), duplicatePct);
    }

    root.classList.add("is-loaded");
  }

  window.renderHeroStats = renderHeroStats;
})();
