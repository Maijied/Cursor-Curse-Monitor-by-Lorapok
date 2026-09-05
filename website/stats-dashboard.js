/**
 * Animated stats for hero dashboard — wired from site-data.json via site.js
 */
(function () {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function easeOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  /**
   * @param {Element | null | undefined} el
   * @param {number | null | undefined} end
   * @param {{ duration?: number; start?: number; delay?: number }} [options]
   */
  function animateCount(el, end, options = {}) {
    if (!el || end == null || Number.isNaN(Number(end))) return;
    const target = Number(end);
    const duration = options.duration ?? 1600;
    const start = options.start ?? 0;
    const delay = options.delay ?? 0;

    if (reducedMotion || duration <= 0) {
      el.textContent = target.toLocaleString();
      el.classList.remove("is-counting");
      return;
    }

    el.classList.add("is-counting");
    const startTime = performance.now() + delay;

    function frame(now) {
      if (now < startTime) {
        requestAnimationFrame(frame);
        return;
      }
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeOutExpo(t);
      const current = t >= 1 ? target : Math.round(start + (target - start) * eased);
      el.textContent = current.toLocaleString();
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        el.classList.remove("is-counting");
      }
    }
    requestAnimationFrame(frame);
  }

  /**
   * @param {Element | null | undefined} el
   * @param {number | null | undefined} value
   * @param {{ verified?: boolean; duration?: number; tone?: string; delay?: number }} [options]
   */
  function renderStatCount(el, value, options = {}) {
    if (!el) return;
    const verified = options.verified !== false;
    if (options.tone) {
      el.classList.add("stat-count", `stat-count--${options.tone}`);
    }
    if (!verified || value == null || Number.isNaN(Number(value))) {
      el.textContent = "—";
      el.classList.remove("is-counting");
      return;
    }
    animateCount(el, Number(value), {
      duration: options.duration ?? 1600,
      delay: options.delay ?? 0,
    });
  }

  /**
   * @param {string | Element} target
   * @param {number | null | undefined} value
   * @param {{ verified?: boolean; duration?: number; tone?: string }} [options]
   */
  function animateStatCount(target, value, options = {}) {
    const nodes =
      typeof target === "string"
        ? [...document.querySelectorAll(target)]
        : target
          ? [target]
          : [];
    nodes.forEach((el) => renderStatCount(el, value, options));
  }

  function setBar(el, pct, tone) {
    if (!(el instanceof HTMLElement)) return;
    if (tone) el.classList.add(`stat-meter--${tone}`);
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
   */
  function resolveHeroDownloadStats(data) {
    const breakdown = data?.downloads?.breakdown ?? {};
    const canonical = breakdown.openVsxCanonical ?? data?.ovsx?.downloadCount ?? null;
    const duplicate = breakdown.openVsxDuplicate ?? data?.ovsxDuplicate?.downloadCount ?? null;
    const vscode = breakdown.vscodeMarketplace ?? data?.vscode?.downloadCount ?? null;
    const github =
      "githubAllAssets" in breakdown
        ? (breakdown.githubAllAssets ?? null)
        : (data?.github?.totalReleaseDownloads ??
          data?.github?.allAssetsDownloadCount ??
          null);
    const fullyVerified = data?.downloads?.verified === true;
    const hasChannelData = canonical != null || duplicate != null || vscode != null;
    const displayable = fullyVerified || hasChannelData;
    const combined = Number(
      data?.downloads?.openVsxCombined ?? (canonical != null && duplicate != null ? canonical + duplicate : canonical ?? 0),
    );
    const total = fullyVerified
      ? Number(data?.downloads?.displayTotal ?? data?.downloads?.total ?? 0)
      : displayable
        ? (canonical ?? 0) + (duplicate ?? 0) + (vscode ?? 0) + (github ?? 0)
        : null;

    return {
      displayable,
      fullyVerified,
      total,
      combined,
      canonical: canonical != null ? Number(canonical) : null,
      duplicate: duplicate != null ? Number(duplicate) : null,
      vscode: vscode != null ? Number(vscode) : null,
      github: github != null ? Number(github) : null,
    };
  }

  /**
   * @param {Record<string, unknown>} data site-data.json payload
   * @param {{ verified?: boolean }} [options]
   */
  function renderHeroStats(data, options = {}) {
    const root = document.getElementById("hero-stats-dashboard");
    if (!root || !data) return;

    const stats = resolveHeroDownloadStats(data);
    const downloadsVerified = options.verified === true || stats.displayable;
    const downloads = stats.total ?? 0;
    const visits = Number(data.visitors?.websiteVisits ?? 0);
    const engagement = Number(data.visitors?.totalEngagement ?? 0);
    const canonical = stats.canonical ?? 0;
    const duplicate = stats.duplicate ?? 0;
    const combined = stats.combined;
    const vscode = stats.vscode;
    const github = stats.github;

    const maxScale = Math.max(
      downloadsVerified ? downloads : 0,
      visits,
      engagement,
      downloadsVerified ? combined : 0,
      1,
    );

    renderStatCount(root.querySelector("[data-hero-downloads]"), downloadsVerified ? downloads : null, {
      verified: downloadsVerified,
      duration: 1800,
      tone: "total",
      delay: 0,
    });
    renderStatCount(root.querySelector("[data-hero-ovsx-combined]"), downloadsVerified ? combined : null, {
      verified: downloadsVerified,
      duration: 1500,
      tone: "ovsx",
      delay: 120,
    });
    renderStatCount(root.querySelector("[data-hero-vscode]"), downloadsVerified ? vscode : null, {
      verified: downloadsVerified,
      duration: 1500,
      tone: "vscode",
      delay: 200,
    });
    renderStatCount(root.querySelector("[data-hero-github]"), downloadsVerified ? github : null, {
      verified: downloadsVerified && github != null,
      duration: 1500,
      tone: "github",
      delay: 280,
    });
    renderStatCount(root.querySelector("[data-hero-ovsx-canonical]"), downloadsVerified ? canonical : null, {
      verified: downloadsVerified,
      duration: 1400,
      tone: "canonical",
      delay: 360,
    });
    renderStatCount(root.querySelector("[data-hero-ovsx-duplicate]"), downloadsVerified ? duplicate : null, {
      verified: downloadsVerified,
      duration: 1400,
      tone: "duplicate",
      delay: 440,
    });
    renderStatCount(root.querySelector("[data-hero-visits]"), visits, {
      verified: true,
      duration: 1500,
      tone: "visits",
      delay: 520,
    });
    renderStatCount(root.querySelector("[data-hero-engagement]"), engagement, {
      verified: true,
      duration: 1500,
      tone: "engagement",
      delay: 600,
    });

    const universe = document.getElementById("hero-download-universe");
    if (universe) universe.classList.add("is-live");

    if (downloadsVerified) {
      const barDelay = 400;
      setTimeout(() => {
        setBar(root.querySelector("[data-hero-downloads-bar]"), (downloads / maxScale) * 100, "total");
        if (combined > 0) {
          const canonicalPct = Math.round((canonical / combined) * 100);
          const duplicatePct = 100 - canonicalPct;
          setBar(root.querySelector("[data-hero-ovsx-canonical-bar]"), canonicalPct, "canonical");
          setBar(root.querySelector("[data-hero-ovsx-duplicate-bar]"), duplicatePct, "duplicate");
        }
        setBar(root.querySelector("[data-hero-visits-bar]"), (visits / maxScale) * 100, "visits");
        setBar(root.querySelector("[data-hero-engagement-bar]"), (engagement / maxScale) * 100, "engagement");
      }, reducedMotion ? 0 : barDelay);
    } else {
      setBar(root.querySelector("[data-hero-downloads-bar]"), 0, "total");
      setBar(root.querySelector("[data-hero-ovsx-canonical-bar]"), 0, "canonical");
      setBar(root.querySelector("[data-hero-ovsx-duplicate-bar]"), 0, "duplicate");
    }

    const status = document.getElementById("hero-stats-status");
    if (status) {
      status.textContent = downloadsVerified
        ? stats.fullyVerified
          ? `Community downloads ${downloads.toLocaleString()} total. Open VSX ${combined.toLocaleString()}.`
          : `Community downloads ${downloads.toLocaleString()} total (marketplace channels; GitHub pending).`
        : "Community download stats unavailable.";
    }

    root.classList.add("is-loaded");
  }

  window.resolveHeroDownloadStats = resolveHeroDownloadStats;
  window.renderHeroStats = renderHeroStats;
  window.animateStatCount = animateStatCount;
})();
