/**
 * Loads site-data.json and powers dynamic install UI + photo lightbox.
 * Supports both Open VSX and VS Code Marketplace data.
 */

const SUBSCRIBE_KEYS = {
  email: "ccm-subscribe-email",
  snoozeUntil: "ccm-subscribe-snooze-until",
  declined: "ccm-subscribe-declined",
};
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
  if (!button) return;
  const loader = button.querySelector(".subscribe-btn-loader");
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  if (loader) loader.hidden = !loading;
}

async function submitSubscribeRequest({ email, subscribeUrl, source }) {
  const response = await fetch(subscribeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, source, consent: true }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Subscribe failed");
  markSubscribedEmail(email);
  return body;
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

  const downloadsVerified = data?.downloads?.verified === true;

  if (data) {
    const setText = (sel, text) => {
      $$(sel).forEach((el) => { el.textContent = text; });
    };
    const setHref = (sel, href) => {
      $$(sel).forEach((el) => { el.href = href; });
    };
    const fmt = (n) => (n == null || Number.isNaN(Number(n)) ? "—" : Number(n).toLocaleString());
    const fmtDownloads = (n) => (downloadsVerified ? fmt(n) : "—");

    // KPI strip (downloads + engagement)
    setText("[data-downloads-total]", fmtDownloads(data.downloads?.displayTotal ?? data.downloads?.total));
    setText("[data-visits-total]", fmt(data.visitors?.websiteVisits));
    setText("[data-engagement-total]", fmt(data.visitors?.totalEngagement));

    const canonicalDl = data.downloads?.breakdown?.openVsxCanonical ?? data.ovsx?.downloadCount ?? 0;
    const duplicateDl = data.downloads?.breakdown?.openVsxDuplicate ?? data.ovsxDuplicate?.downloadCount ?? 0;
    const combinedDl = data.downloads?.openVsxCombined ?? canonicalDl + duplicateDl;
    setText("[data-ovsx-canonical]", fmtDownloads(canonicalDl));
    setText("[data-ovsx-duplicate]", fmtDownloads(duplicateDl));
    setText("[data-ovsx-combined]", fmtDownloads(combinedDl));
    setText("[data-ovsx-canonical-legend]", fmtDownloads(canonicalDl));
    setText("[data-ovsx-duplicate-legend]", fmtDownloads(duplicateDl));
    setText("[data-ovsx-combined-legend]", fmtDownloads(combinedDl));
    setHref("[data-href-ovsx-duplicate]", data.ovsxDuplicate?.url ?? "#");

    const breakdownEl = $("#download-breakdown");
    if (breakdownEl && downloadsVerified && combinedDl > 0) {
      breakdownEl.hidden = false;
      const canonicalPct = Math.round((canonicalDl / combinedDl) * 100);
      const duplicatePct = 100 - canonicalPct;
      const barCanonical = document.querySelector("[data-ovsx-bar-canonical]");
      const barDuplicate = document.querySelector("[data-ovsx-bar-duplicate]");
      if (barCanonical instanceof HTMLElement) barCanonical.style.width = `${canonicalPct}%`;
      if (barDuplicate instanceof HTMLElement) barDuplicate.style.width = `${duplicatePct}%`;
    }

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
    const firefoxVersionLabel = firefoxPublished
      ? (data.browserExtension?.firefox?.version ?? data.browserExtension?.version ?? data.version ?? "—")
      : `pending AMO · v${data.version ?? data.packageVersion ?? "—"} on GitHub`;
    setText("[data-firefox-version]", firefoxVersionLabel);
    $$("[data-href-firefox]").forEach((el) => {
      if (!firefoxPublished) {
        el.title = "Firefox AMO listing pending — install from GitHub Release";
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
        message.hidden = false;
        message.className = "subscribe-message error";
        message.textContent = "Enter your email address.";
        return;
      }
      if (consent && !consent.checked) {
        message.hidden = false;
        message.className = "subscribe-message error";
        message.textContent = "Please agree to receive product updates.";
        return;
      }

      message.hidden = false;
      message.className = "subscribe-message pending";
      message.textContent = "Subscribing…";
      setSubscribeButtonLoading(submitBtn, true);

      try {
        const body = await submitSubscribeRequest({ email, subscribeUrl, source: "website" });
        message.className = "subscribe-message success";
        message.textContent = body.message || "You're subscribed!";
        form.reset();
        closeSubscribeModal();
      } catch (err) {
        message.className = "subscribe-message error";
        message.textContent = err instanceof Error ? err.message : "Could not subscribe right now.";
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

    const openModal = () => {
      if (!shouldShowSubscribeModal()) return;
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

    if (!form || !input || !message) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = String(input.value || "").trim().toLowerCase();
      const consent = form.querySelector("#subscribe-modal-consent");
      if (!email) {
        message.hidden = false;
        message.className = "subscribe-message error";
        message.textContent = "Enter your email address.";
        return;
      }
      if (consent && !consent.checked) {
        message.hidden = false;
        message.className = "subscribe-message error";
        message.textContent = "Please agree to receive product updates.";
        return;
      }

      message.hidden = false;
      message.className = "subscribe-message pending";
      message.textContent = "Subscribing…";
      setSubscribeButtonLoading(submitBtn, true);

      try {
        const body = await submitSubscribeRequest({ email, subscribeUrl, source: "website-modal" });
        message.className = "subscribe-message success";
        message.textContent = body.message || "You're subscribed!";
        window.setTimeout(closeModal, 1200);
      } catch (err) {
        message.className = "subscribe-message error";
        message.textContent = err instanceof Error ? err.message : "Could not subscribe right now.";
      } finally {
        setSubscribeButtonLoading(submitBtn, false);
      }
    });

    window.addEventListener("beforeunload", () => {
      if (modalTimer) window.clearTimeout(modalTimer);
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
