/**
 * Loads site-data.json and powers dynamic install UI + photo lightbox.
 * Supports both Open VSX and VS Code Marketplace data.
 */

/**
 * Append ?v=buildId to same-origin static assets (CSS/JS/images).
 * @param {string | undefined | null} buildId
 */
function applyAssetCacheBust(buildId) {
  if (!buildId) return;
  const suffix = `?v=${buildId}`;
  const stamp = (url) => {
    if (!url || url.startsWith("http") || url.startsWith("//") || url.startsWith("data:")) return url;
    const base = url.split("?")[0];
    return `${base}${suffix}`;
  };

  document.querySelectorAll('link[rel="stylesheet"][href]').forEach((el) => {
    if (el instanceof HTMLLinkElement && el.href) {
      const path = el.getAttribute("href");
      if (path) el.setAttribute("href", stamp(path));
    }
  });

  document.querySelectorAll("script[src]").forEach((el) => {
    if (el instanceof HTMLScriptElement) {
      const path = el.getAttribute("src");
      if (path) el.setAttribute("src", stamp(path));
    }
  });

  document.querySelectorAll("img[src]").forEach((el) => {
    if (!(el instanceof HTMLImageElement)) return;
    const path = el.getAttribute("src");
    if (path && !path.includes("fonts.googleapis")) el.setAttribute("src", stamp(path));
  });
}

const SUBSCRIBE_KEYS = {
  email: "ccm-subscribe-email",
  snoozeUntil: "ccm-subscribe-snooze-until",
  declined: "ccm-subscribe-declined",
};
const WELCOME_KEY = "ccm_welcome_seen";
const SUBSCRIBE_PROMPT_DELAY_MS = 30_000;
const SUBSCRIBE_SNOOZE_ONE_DAY_MS = 24 * 60 * 60 * 1000;

const IDE_COLORS = {
  cursor: "#6C5CE7",
  vscode: "#007ACC",
  windsurf: "#00C896",
  vscodium: "#2F80ED",
  void: "#8B5CF6",
  gitpod: "#FFAE33",
  positron: "#447099",
  trae: "#00D4AA",
  kiro: "#FF9900",
  qoder: "#1677FF",
  pearai: "#F59E0B",
  "code-server": "#4B5568",
  theia: "#F7941E",
  "azure-data-studio": "#0078D4",
  coder: "#4C5A73",
};

function renderSupportedIdes(data) {
  const grid = document.getElementById("supported-ides-grid");
  if (!grid || !data?.supportedIdes?.ides?.length) return;

  const title = document.getElementById("supported-ides-title");
  const lead = document.getElementById("supported-ides-lead");
  if (title && data.supportedIdes.headline) title.textContent = data.supportedIdes.headline;
  if (lead && data.supportedIdes.subline) lead.textContent = data.supportedIdes.subline;

  grid.replaceChildren();
  const ides = data.supportedIdes.ides;
  for (let i = 0; i < ides.length; i++) {
    const ide = ides[i];
    const color = IDE_COLORS[ide.id] || "#7c5cff";
    const initial = (ide.name || "?").charAt(0).toUpperCase();
    const slug = ide.icon || ide.id;
    const card = document.createElement(ide.website ? "a" : "article");
    card.className = `ide-card${ide.featured ? " featured" : ""}`;
    card.style.setProperty("--ide-color", color);
    card.style.setProperty("--ide-stagger-ms", `${Math.min(i * 32, 500)}ms`);
    if (ide.website) {
      card.href = ide.website;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    }

    const icon = document.createElement("div");
    icon.className = "ide-icon";
    icon.setAttribute("aria-hidden", "true");
    if (ide.id === "cursor") icon.classList.add("ide-icon-watching");

    const mark = document.createElement("img");
    mark.className = "ide-icon-mark";
    mark.src = `assets/ides/${encodeURIComponent(slug)}.svg`;
    mark.alt = "";
    mark.decoding = "async";
    mark.addEventListener("error", () => {
      mark.remove();
      icon.textContent = initial;
      icon.classList.add("ide-icon-fallback");
    }, { once: true });
    icon.append(mark);

    const name = document.createElement("p");
    name.className = "ide-name";
    name.textContent = ide.name;

    const tagline = document.createElement("p");
    tagline.className = "ide-tagline";
    tagline.textContent = ide.tagline;

    const market = document.createElement("p");
    market.className = "ide-market";
    market.textContent = ide.marketplaceLabel;

    card.append(icon, name, tagline, market);
    grid.append(card);
  }
  revealSupportedIdes(grid);
}

function revealSupportedIdes(grid) {
  const cards = [...grid.querySelectorAll(".ide-card")];
  const show = () => {
    grid.classList.add("ides-visible");
    for (const card of cards) card.classList.remove("ide-card-unseen");
  };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof IntersectionObserver !== "function") {
    show();
    return;
  }
  for (const card of cards) card.classList.add("ide-card-unseen");
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        show();
        io.disconnect();
      }
    },
    { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
  );
  io.observe(grid);
}

function getSubscribeSiteState() {
  const declined = window.localStorage.getItem(SUBSCRIBE_KEYS.declined) === "1";
  const subscribedEmail = window.localStorage.getItem(SUBSCRIBE_KEYS.email);
  const snoozeRaw = window.localStorage.getItem(SUBSCRIBE_KEYS.snoozeUntil);
  const snoozeUntilMs = snoozeRaw ? Number(snoozeRaw) : null;
  return {
    declined,
    subscribedEmail: subscribedEmail || null,
    snoozeUntilMs: Number.isFinite(snoozeUntilMs) ? snoozeUntilMs : null,
  };
}

function shouldShowSubscribeModal(state = getSubscribeSiteState()) {
  if (state.declined) return false;
  if (state.subscribedEmail) return false;
  if (!state.snoozeUntilMs) return true;
  return Date.now() >= state.snoozeUntilMs;
}

function snoozeSubscribeModalOneDay() {
  window.localStorage.setItem(
    SUBSCRIBE_KEYS.snoozeUntil,
    String(Date.now() + SUBSCRIBE_SNOOZE_ONE_DAY_MS)
  );
}

function declineSubscribeModal() {
  window.localStorage.setItem(SUBSCRIBE_KEYS.declined, "1");
}

function markSubscribedEmail(email) {
  window.localStorage.setItem(SUBSCRIBE_KEYS.email, email);
  window.localStorage.removeItem(SUBSCRIBE_KEYS.snoozeUntil);
}

function setSubscribeButtonLoading(button, loading) {
  if (window.CcmUi?.setButtonLoading) {
    window.CcmUi.setButtonLoading(button, loading);
    return;
  }
  if (!button) return;
  const loader = button.querySelector(".btn-larvae-loader, .subscribe-btn-loader");
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  button.setAttribute("aria-busy", loading ? "true" : "false");
  if (loader) loader.hidden = !loading;
}

function showSubscribeFeedback(el, { tone, title, message }) {
  if (window.CcmUi?.showFeedback) {
    window.CcmUi.showFeedback(el, { tone, title, message });
    return;
  }
  if (!el) return;
  el.hidden = false;
  el.className = `ccm-feedback ccm-feedback--${tone} ccm-feedback--visible`;
  el.textContent = message ?? "";
}

async function submitSubscribeRequest({ email, subscribeUrl, source }) {
  const response = await fetch(subscribeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, source, consent: true }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.mailWarning || "Subscribe failed");
  markSubscribedEmail(email);
  return body;
}

function subscribeSuccessFeedback(body) {
  if (body.emailed === false) {
    return {
      tone: "error",
      title: "Subscribed, but email not delivered",
      message:
        body.mailWarning ||
        body.message ||
        "You're on the list, but the welcome email could not be sent. We'll retry when mail is restored.",
    };
  }
  return {
    tone: "success",
    title: "You're subscribed!",
    message: body.message || "Release notes will land in your inbox.",
  };
}

/**
 * Sync JSON-LD softwareVersion and downloadUrl with live site-data.
 */
function updateStructuredDataVersion(data) {
  const version = data.packageVersion || data.version;
  if (!version) return;
  document.querySelectorAll('script[type="application/ld+json"]').forEach((node) => {
    try {
      const json = JSON.parse(node.textContent || "");
      const graph = json["@graph"];
      if (!Array.isArray(graph)) return;
      let changed = false;
      for (const item of graph) {
        if (item["@type"] !== "SoftwareApplication") continue;
        if (version && item.softwareVersion !== version) {
          item.softwareVersion = version;
          changed = true;
        }
        if (data.github?.vsixUrl && item.downloadUrl !== data.github.vsixUrl) {
          item.downloadUrl = data.github.vsixUrl;
          changed = true;
        }
      }
      if (changed) node.textContent = JSON.stringify(json);
    } catch {
      // ignore malformed JSON-LD
    }
  });
}

(async function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const NOTICE_URL = "https://cursor-dev.lorapok.tech/api/notice";
  const LIVE_SITE_DATA_URL = "https://cursor-dev.lorapok.tech/api/site-data";

  function mergeLiveSiteData(staticData, liveData) {
    if (!liveData || liveData.error) return staticData;
    const staticAt = staticData?.generatedAt ? Date.parse(String(staticData.generatedAt)) : 0;
    const liveAt = Date.parse(String(liveData.liveRefreshedAt ?? liveData.generatedAt ?? ""));
    if (!staticData) return liveData;

    const liveVerified = liveData.downloads?.verified === true;
    const staticVerified = staticData.downloads?.verified === true;
    const liveTotal = Number(liveData.downloads?.displayTotal ?? liveData.downloads?.total ?? 0);
    const staticTotal = Number(staticData.downloads?.displayTotal ?? staticData.downloads?.total ?? 0);
    const preferLiveDownloads =
      liveVerified && (!staticVerified || liveTotal >= staticTotal || (!Number.isNaN(liveAt) && liveAt >= staticAt));

    const useLiveEnvelope =
      !Number.isNaN(liveAt) && (liveAt >= staticAt || preferLiveDownloads || liveData.liveRefreshedAt);

    if (!useLiveEnvelope) return staticData;

    const merged = { ...staticData, ...liveData };

    if (liveData.packageVersion === "0.0.0" && staticData.packageVersion && staticData.packageVersion !== "0.0.0") {
      merged.packageVersion = staticData.packageVersion;
    }
    if (liveData.version === "0.0.0" && staticData.version && staticData.version !== "0.0.0") {
      merged.version = staticData.version;
    }

    if (preferLiveDownloads && liveData.downloads) {
      merged.downloads = {
        ...staticData.downloads,
        ...liveData.downloads,
        breakdown: {
          ...(staticData.downloads?.breakdown ?? {}),
          ...(liveData.downloads?.breakdown ?? {}),
        },
      };
    } else if (staticVerified && liveData.downloads?.verified !== true) {
      merged.downloads = {
        ...staticData.downloads,
        breakdown: {
          ...(staticData.downloads.breakdown ?? {}),
          ...(liveData.downloads?.breakdown ?? {}),
        },
        openVsxCombined:
          liveData.downloads?.openVsxCombined ?? staticData.downloads.openVsxCombined,
      };
    } else if (liveData.downloads?.verified !== true && liveData.downloads?.breakdown) {
      merged.downloads = {
        ...(staticData.downloads ?? {}),
        ...liveData.downloads,
        verified: staticData.downloads?.verified ?? false,
      };
    }

    const staticVisits = staticData.visitors?.websiteVisits;
    const liveVisits = liveData.visitors?.websiteVisits;
    if (liveVisits != null && Number(liveVisits) > Number(staticVisits ?? 0)) {
      merged.visitors = { ...staticData.visitors, ...liveData.visitors };
    } else if (staticVisits != null && (liveVisits == null || Number(liveVisits) === 0)) {
      merged.visitors = { ...liveData.visitors, ...staticData.visitors };
    }

    merged.assets = {
      ...(staticData.assets ?? {}),
      ...(liveData.assets ?? {}),
      buildId: staticData.assets?.buildId ?? liveData.assets?.buildId,
    };

    return merged;
  }
  const FALLBACK_NOTICE = {
    enabled: false,
    id: "site-data-fallback",
    title: "Cursor Curse Monitor by Lorapok",
    shortMessage: "Visit cursor.lorapok.tech for the latest release and install links.",
    message: "Check cursor.lorapok.tech for release notes, support, and marketplace install links.",
    severity: "info",
    dismissible: true,
    feedbackUrl: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues",
    collaborateUrl: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/discussions",
  };

  // Register local interactions before any network request. A slow data or
  // notice request must never make image previews feel unresponsive.
  initMobileNav();
  initWelcomeBanner();
  initEcosystemTabs();
  initLightbox();

  let data;
  try {
    const res = await fetch("site-data.json", { cache: "no-store" });
    if (!res.ok) throw new Error(res.statusText);
    data = await res.json();
  } catch {
    data = null;
  }

  try {
    const liveRes = await fetch(LIVE_SITE_DATA_URL, { cache: "no-store" });
    if (liveRes.ok) {
      const live = await liveRes.json();
      data = mergeLiveSiteData(data, live);
    }
  } catch {
    // Static site-data.json is enough when Mission Control API is unreachable.
  }

  const downloadsVerified =
    typeof window.resolveHeroDownloadStats === "function"
      ? window.resolveHeroDownloadStats(data).displayable
      : data?.downloads?.verified === true;

  if (data) {
    applyAssetCacheBust(data.assets?.buildId);
    const setText = (sel, text) => {
      $$(sel).forEach((el) => { el.textContent = text; });
    };
    const setHref = (sel, href) => {
      $$(sel).forEach((el) => { el.href = href; });
    };
    const fmt = (n) => (n == null || Number.isNaN(Number(n)) ? "—" : Number(n).toLocaleString());
    const animateDownloadCount = (selector, value, tone) => {
      if (typeof window.animateStatCount === "function") {
        window.animateStatCount(selector, value, { verified: downloadsVerified, tone });
        return;
      }
      $$(selector).forEach((el) => {
        el.textContent = downloadsVerified ? fmt(value) : "—";
      });
    };

    setText("[data-visits-total]", fmt(data.visitors?.websiteVisits));
    setText("[data-engagement-total]", fmt(data.visitors?.totalEngagement));

    const canonicalDl = data.downloads?.breakdown?.openVsxCanonical ?? data.ovsx?.downloadCount ?? null;
    const duplicateDl = data.downloads?.breakdown?.openVsxDuplicate ?? data.ovsxDuplicate?.downloadCount ?? null;
    const combinedDl = data.downloads?.openVsxCombined ?? (canonicalDl != null && duplicateDl != null ? canonicalDl + duplicateDl : canonicalDl);
    const vscodeDl = data.downloads?.breakdown?.vscodeMarketplace ?? data.vscode?.downloadCount ?? null;

    animateDownloadCount("[data-ovsx-canonical]", canonicalDl, "canonical");
    animateDownloadCount("[data-ovsx-duplicate]", duplicateDl, "duplicate");
    animateDownloadCount("[data-ovsx-combined]", combinedDl, "ovsx");
    animateDownloadCount("[data-ovsx-canonical-legend]", canonicalDl, "canonical");
    animateDownloadCount("[data-ovsx-duplicate-legend]", duplicateDl, "duplicate");
    animateDownloadCount("[data-ovsx-combined-legend]", combinedDl, "ovsx");
    animateDownloadCount("[data-vscode-downloads]", vscodeDl, "vscode");
    setHref("[data-href-ovsx-duplicate]", data.ovsxDuplicate?.url ?? "#");

    if (typeof window.renderHeroStats === "function") {
      window.renderHeroStats(data, { verified: downloadsVerified });
    }
    renderSupportedIdes(data);

    // Core version data
    setText("[data-version]", data.version);
    setText("[data-package-version]", data.packageVersion);
    updateStructuredDataVersion(data);
    setText("[data-extension-id]", data.ovsxExtensionId ?? data.extensionId);
    setText("[data-github-tag]", data.github.releaseTag);
    setText("[data-vsix-name]", data.github.vsixName);
    setText("[data-generated]", new Date(data.generatedAt).toLocaleString());

    // Open VSX data
    setText("[data-ovsx-version]", data.ovsx?.version ?? "—");
    setHref("[data-href-ovsx]", data.ovsx?.url ?? "#");

    // VS Code Marketplace data
    setText("[data-vscode-version]", data.vscode?.version ?? "—");
    setHref("[data-href-vscode]", data.vscode?.url ?? "#");

    // GitHub links
    setHref("[data-href-release]", data.github.releaseUrl);
    setHref("[data-href-github-release]", data.github.releaseUrl ?? data.repository);
    setHref("[data-href-vsix]", data.github.vsixUrl);
    setHref("[data-href-repo]", data.repository);
    setHref(
      "[data-href-firefox-xpi]",
      data.browserExtension?.firefox?.xpiUrl ?? data.github?.firefoxXpiUrl ?? data.github?.releaseUrl ?? "#"
    );
    setText(
      "[data-firefox-xpi-name]",
      data.browserExtension?.firefox?.xpiName ?? data.github?.firefoxXpiName ?? "cursor-curse-monitor.xpi"
    );
    const firefoxPublished = Boolean(data.browserExtension?.firefox?.published);
    const firefoxHref = firefoxPublished
      ? (data.browserExtension?.firefox?.url ?? data.productContext?.firefoxUrl)
      : (data.github?.releaseUrl ?? data.github?.vsixUrl ?? "#");
    setHref("[data-href-firefox]", firefoxHref);
    // Keep this label short — it renders inside a pill. The pending case
    // explains itself through the link title set below.
    const firefoxVersionLabel = firefoxPublished
      ? `v${data.browserExtension?.firefox?.version ?? data.browserExtension?.version ?? data.version ?? "—"}`
      : "pending AMO";
    setText("[data-firefox-version]", firefoxVersionLabel);
    $$("[data-href-firefox]").forEach((el) => {
      if (!firefoxPublished) {
        el.title = `Firefox AMO listing pending — install v${
          data.version ?? data.packageVersion ?? "—"
        } from the GitHub Release`;
        el.classList.add("platform-pending");
      }
    });
    setHref(
      "[data-href-chrome-zip]",
      data.browserExtension?.chrome?.zipUrl ?? data.github?.chromeZipUrl ?? data.github?.releaseUrl ?? "#"
    );

    // Install commands
    const cmd = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    cmd("cmd-vsix", data.install.vsixCommand);
    cmd("cmd-release-patch", data.install.releasePatch);
    cmd("cmd-release-minor", data.install.releaseMinor);
    cmd("cmd-ovsx-search", data.install.ovsxSearch);
    cmd("cmd-vscode-search", data.install.vsceSearch ?? data.install.ovsxSearch);

    // Open VSX badge
    const ovsxBadge = $("#ovsx-status");
    if (ovsxBadge && data.ovsx?.version) {
      ovsxBadge.textContent = data.ovsx.downloadable
        ? `Open VSX v${data.ovsx.version} · live`
        : `Open VSX v${data.ovsx.version} · syncing`;
      ovsxBadge.classList.add(data.ovsx.downloadable ? "live" : "pending");
    } else if (ovsxBadge) {
      ovsxBadge.textContent = "Open VSX · not published";
      ovsxBadge.classList.add("pending");
    }

    // VS Code Marketplace badge
    const vscodeBadge = $("#vscode-status");
    if (vscodeBadge && data.vscode?.version) {
      vscodeBadge.textContent = data.vscode.published
        ? `VS Code v${data.vscode.version} · live`
        : `VS Code v${data.vscode.version} · syncing`;
      vscodeBadge.classList.add(data.vscode.published ? "live" : "pending");
    } else if (vscodeBadge) {
      vscodeBadge.textContent = "VS Code · coming soon";
      vscodeBadge.classList.add("pending");
    }

    // Live status in marketplace links section
    const ovsxLive = $("#ovsx-live-status");
    if (ovsxLive) {
      ovsxLive.textContent = data.ovsx?.downloadable ? "✅ Live" : "⏳ Not yet published";
    }
    const vscodeLive = $("#vscode-live-status");
    if (vscodeLive) {
      vscodeLive.textContent = data.vscode?.published ? "✅ Live" : "⏳ Coming soon";
    }

    // OG image and document.title are set at build time via generate-seo.mjs — do not mutate here.
  }

  // Keep remote notice loading independent from local image interactions.
  void initNotice();
  initSubscribe();
  initSubscribeModal();

  function initSubscribe() {
    const form = $("#subscribe-form");
    const input = $("#subscribe-email");
    const message = $("#subscribe-message");
    const submitBtn = $("#subscribe-form-submit");
    if (!form || !input || !message) return;

    const subscribeUrl = data?.social?.subscribe || "https://cursor-dev.lorapok.tech/api/subscribe";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = String(input.value || "").trim().toLowerCase();
      const consent = form.querySelector("#subscribe-consent");
      if (!email) {
        showSubscribeFeedback(message, {
          tone: "error",
          title: "Email required",
          message: "Enter your email address.",
        });
        return;
      }
      if (consent && !consent.checked) {
        showSubscribeFeedback(message, {
          tone: "error",
          title: "Consent required",
          message: "Please agree to receive product updates.",
        });
        return;
      }

      showSubscribeFeedback(message, {
        tone: "pending",
        title: "Subscribing…",
        message: "Our little larvae is sending your request.",
      });
      setSubscribeButtonLoading(submitBtn, true);

      try {
        const body = await submitSubscribeRequest({ email, subscribeUrl, source: "website" });
        const feedback = subscribeSuccessFeedback(body);
        showSubscribeFeedback(message, feedback);
        if (body.emailed !== false) form.reset();
        closeSubscribeModal();
      } catch (err) {
        showSubscribeFeedback(message, {
          tone: "error",
          title: "Could not subscribe",
          message: err instanceof Error ? err.message : "Please try again in a moment.",
        });
      } finally {
        setSubscribeButtonLoading(submitBtn, false);
      }
    });
  }

  function initSubscribeModal() {
    const modal = $("#subscribe-modal");
    if (!modal) return;

    const form = $("#subscribe-modal-form");
    const input = $("#subscribe-modal-email");
    const message = $("#subscribe-modal-message");
    const submitBtn = $("#subscribe-modal-submit");
    const subscribeUrl = data?.social?.subscribe || "https://cursor-dev.lorapok.tech/api/subscribe";
    let modalTimer = null;
    let inlineSubscribeActive = false;
    const subscribeSection = document.getElementById("subscribe");
    const inlineForm = document.getElementById("subscribe-form");

    const cancelScheduledModal = () => {
      if (modalTimer != null) {
        window.clearTimeout(modalTimer);
        modalTimer = null;
      }
    };

    const openModal = () => {
      if (!shouldShowSubscribeModal() || inlineSubscribeActive) return;
      if (subscribeSection) {
        const rect = subscribeSection.getBoundingClientRect();
        const inView = rect.top < window.innerHeight * 0.85 && rect.bottom > window.innerHeight * 0.15;
        if (inView) return;
      }
      modal.hidden = false;
      document.body.classList.add("subscribe-modal-open");
      input?.focus();
    };

    const closeModal = () => {
      modal.hidden = true;
      document.body.classList.remove("subscribe-modal-open");
    };

    window.closeSubscribeModal = closeModal;

    modal.querySelectorAll("[data-subscribe-close]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });

    modal.querySelector("[data-subscribe-later]")?.addEventListener("click", () => {
      snoozeSubscribeModalOneDay();
      closeModal();
    });

    modal.querySelector("[data-subscribe-decline]")?.addEventListener("click", () => {
      declineSubscribeModal();
      closeModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) closeModal();
    });

    if (shouldShowSubscribeModal()) {
      modalTimer = window.setTimeout(openModal, SUBSCRIBE_PROMPT_DELAY_MS);
    }

    inlineForm?.addEventListener("focusin", () => {
      inlineSubscribeActive = true;
      cancelScheduledModal();
    });

    if (subscribeSection && typeof IntersectionObserver === "function") {
      const subscribeObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            inlineSubscribeActive = true;
            cancelScheduledModal();
            if (!modal.hidden) closeModal();
          }
        },
        { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
      );
      subscribeObserver.observe(subscribeSection);
    }

    if (!form || !input || !message) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = String(input.value || "").trim().toLowerCase();
      const consent = form.querySelector("#subscribe-modal-consent");
      if (!email) {
        showSubscribeFeedback(message, {
          tone: "error",
          title: "Email required",
          message: "Enter your email address.",
        });
        return;
      }
      if (consent && !consent.checked) {
        showSubscribeFeedback(message, {
          tone: "error",
          title: "Consent required",
          message: "Please agree to receive product updates.",
        });
        return;
      }

      showSubscribeFeedback(message, {
        tone: "pending",
        title: "Subscribing…",
        message: "Hang tight — almost there.",
      });
      setSubscribeButtonLoading(submitBtn, true);

      try {
        const body = await submitSubscribeRequest({ email, subscribeUrl, source: "website-modal" });
        const feedback = subscribeSuccessFeedback(body);
        showSubscribeFeedback(message, feedback);
        if (body.emailed !== false) window.setTimeout(closeModal, 1200);
      } catch (err) {
        showSubscribeFeedback(message, {
          tone: "error",
          title: "Could not subscribe",
          message: err instanceof Error ? err.message : "Please try again in a moment.",
        });
      } finally {
        setSubscribeButtonLoading(submitBtn, false);
      }
    });

    window.addEventListener("beforeunload", () => {
      cancelScheduledModal();
    });
  }

  async function initNotice() {
    const banner = $("#dev-notice-banner");
    const content = $("#dev-notice-content");
    const duplicate = $(".dev-notice-duplicate");
    const dismiss = $("#dev-notice-dismiss");
    const pause = $("#dev-notice-pause");
    if (!banner || !content) return;

    let notice = data?.notice?.enabled ? { ...FALLBACK_NOTICE, ...data.notice } : null;
    try {
      const response = await fetch(NOTICE_URL, { cache: "no-store" });
      if (response.ok) {
        const live = await response.json();
        if (live?.enabled && live.title && (live.shortMessage || live.message)) notice = live;
        else notice = null;
      }
    } catch {
      // Keep site-data notice when admin API is unavailable.
    }

    if (!notice?.enabled) return;

    const dismissedKey = `ccm-notice-dismissed:${notice.id || notice.title}`;
    if (notice.dismissible && window.localStorage.getItem(dismissedKey) === "1") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const buildContent = () => {
      const fragment = document.createDocumentFragment();
      const badge = document.createElement("span");
      badge.className = "notice-badge";
      badge.textContent = notice.title;
      fragment.append(badge);

      const text = document.createElement("span");
      text.textContent = notice.shortMessage || notice.message;
      fragment.append(text);

      for (const [label, href] of [["Report an issue", notice.feedbackUrl], ["Collaborate", notice.collaborateUrl]]) {
        if (!href) continue;
        const link = document.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = label;
        fragment.append(link);
      }
      return fragment;
    };

    content.replaceChildren(buildContent());
    if (duplicate) {
      duplicate.replaceChildren(buildContent());
      duplicate.inert = true;
    }
    banner.hidden = false;
    banner.setAttribute("aria-label", notice.title);

    if (pause && !reducedMotion) {
      pause.hidden = false;
      pause.addEventListener("click", () => {
        const paused = banner.classList.toggle("is-paused");
        pause.setAttribute("aria-pressed", paused ? "true" : "false");
        pause.setAttribute("aria-label", paused ? "Resume announcement scroll" : "Pause announcement scroll");
        pause.textContent = paused ? "Play" : "Pause";
      });
    }

    if (dismiss) {
      dismiss.hidden = !notice.dismissible;
      dismiss.addEventListener("click", () => {
        window.localStorage.setItem(dismissedKey, "1");
        banner.hidden = true;
      });
    }
  }
})();

/**
 * First-visit welcome banner — dismissed state stored in localStorage.
 */
function initWelcomeBanner() {
  const banner = document.getElementById("welcome-banner");
  const dismiss = document.getElementById("welcome-banner-dismiss");
  if (!banner || !dismiss) return;
  if (window.localStorage.getItem(WELCOME_KEY) === "1") return;

  banner.hidden = false;
  dismiss.addEventListener("click", () => {
    window.localStorage.setItem(WELCOME_KEY, "1");
    banner.hidden = true;
  });
}

/**
 * Mobile hamburger menu — toggles `.nav-open` on `#nav-links`.
 */
function initMobileNav() {
  const toggle = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");
  if (!toggle || !links) return;

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    links.classList.toggle("nav-open", open);
    document.body.classList.toggle("nav-menu-open", open);
  };

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  links.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  window.matchMedia("(min-width: 901px)").addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}

/**
 * Initializes ecosystem tabs with accessible panel switching and automatic cycling.
 */
function initEcosystemTabs() {
  const tabs = [...document.querySelectorAll("[data-ecosystem-tab]")];
  const panels = [...document.querySelectorAll("[data-ecosystem-panel]")];
  const pauseBtn = document.getElementById("ecosystem-rotation-pause");
  if (!tabs.length || !panels.length) return;

  const activate = (id) => {
    tabs.forEach((tab) => {
      const on = tab.dataset.ecosystemTab === id;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
    });
    panels.forEach((panel) => {
      const on = panel.dataset.ecosystemPanel === id;
      panel.classList.toggle("active", on);
      panel.hidden = !on;
    });
  };

  let rotationActive = true;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stopRotation = () => {
    rotationActive = false;
  };

  const setPaused = (paused) => {
    rotationActive = !paused;
    if (!pauseBtn) return;
    pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
    pauseBtn.setAttribute("aria-label", paused ? "Resume automatic tab rotation" : "Pause automatic tab rotation");
    pauseBtn.textContent = paused ? "Play" : "Pause";
  };

  if (pauseBtn && !prefersReducedMotion.matches) {
    pauseBtn.addEventListener("click", () => {
      setPaused(rotationActive);
    });
  } else if (pauseBtn) {
    pauseBtn.hidden = true;
    stopRotation();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      stopRotation();
      if (pauseBtn) setPaused(true);
      activate(tab.dataset.ecosystemTab || "ide");
    });
    tab.addEventListener("keydown", (event) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      stopRotation();
      if (pauseBtn) setPaused(true);
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      tabs[next].focus();
      activate(tabs[next].dataset.ecosystemTab || "ide");
    });
  });

  tabs.forEach((tab, index) => {
    tab.tabIndex = index === 0 ? 0 : -1;
  });

  const ecosystemRoot = tabs[0]?.closest(".ecosystem-section");
  if (ecosystemRoot) {
    ecosystemRoot.addEventListener("focusin", () => {
      stopRotation();
      if (pauseBtn) setPaused(true);
    });
  }

  let i = 0;
  const ids = tabs.map((t) => t.dataset.ecosystemTab).filter(Boolean);
  setInterval(() => {
    if (document.hidden || !ids.length || !rotationActive || prefersReducedMotion.matches) return;
    i = (i + 1) % ids.length;
    activate(ids[i]);
  }, 8000);
}

/**
 * Initializes the image lightbox and its controls for opening, closing, and navigating between images.
 */
function initLightbox() {
  const lightbox = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-img");
  const caption = document.getElementById("lightbox-caption");
  const counter = document.getElementById("lightbox-counter");
  if (!lightbox || !img) return;

  let activeGroup = "";

  const getVisibleTriggers = (group = activeGroup) => {
    return [...document.querySelectorAll(".lightbox-trigger")].filter((btn) => {
      if (group && (btn.dataset.lightboxGroup || "") !== group) return false;
      const figure = btn.closest(".gallery-item");
      return !figure || !figure.hidden;
    });
  };

  let index = 0;
  let lastTrigger = null;

  const show = (i, group = activeGroup) => {
    activeGroup = group;
    const triggers = getVisibleTriggers(group);
    if (!triggers.length) return;
    index = (i + triggers.length) % triggers.length;
    const btn = triggers[index];
    const src = btn.dataset.src || btn.querySelector("img")?.src;
    const alt = btn.querySelector("img")?.alt || btn.dataset.caption || "";
    if (!src) return;

    img.classList.remove("is-loaded");
    img.onload = () => {
      img.classList.add("is-loaded");
    };
    img.src = src;
    if (img.complete) {
      img.classList.add("is-loaded");
    }
    img.alt = alt;
    caption.textContent = btn.dataset.caption || alt;
    counter.textContent = `${index + 1} / ${triggers.length}`;
    lastTrigger = btn;
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    lightbox.querySelector(".lightbox-close")?.focus();
  };

  const close = () => {
    const restore = lastTrigger;
    lastTrigger = null;
    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    img.classList.remove("is-loaded");
    img.removeAttribute("src");
    if (restore?.isConnected) {
      restore.focus();
    }
  };

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".lightbox-trigger");
    if (!trigger) return;
    const group = trigger.dataset.lightboxGroup || "";
    const triggers = getVisibleTriggers(group);
    const triggerIdx = triggers.indexOf(trigger);
    if (triggerIdx !== -1) {
      e.preventDefault();
      show(triggerIdx, group);
    }
  });

  lightbox.querySelectorAll("[data-lightbox-close]").forEach((el) => {
    el.addEventListener("click", close);
  });

  lightbox.querySelector(".lightbox-prev")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show(index - 1);
  });

  lightbox.querySelector(".lightbox-next")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show(index + 1);
  });

  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });

  initGalleryFilters();
}

/**
 * Filter gallery items by category
 */
function initGalleryFilters() {
  const filterBtns = [...document.querySelectorAll(".gallery-filter-btn")];
  const galleryItems = [...document.querySelectorAll(".gallery-item")];
  if (!filterBtns.length || !galleryItems.length) return;

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      const filter = btn.dataset.filter || "all";

      galleryItems.forEach((item) => {
        const category = item.dataset.category || "";
        if (filter === "all" || category.includes(filter)) {
          item.hidden = false;
        } else {
          item.hidden = true;
        }
      });
    });
  });
}
