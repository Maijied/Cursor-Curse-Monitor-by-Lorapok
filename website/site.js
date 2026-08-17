/**
 * Loads site-data.json and powers dynamic install UI + photo lightbox.
 * Supports both Open VSX and VS Code Marketplace data.
 */
(async function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  let social = null;
  try {
    const socialRes = await fetch("social.json", { cache: "no-store" });
    if (socialRes.ok) social = await socialRes.json();
  } catch {
    /* ignore */
  }

  const ADMIN_API = social?.api?.base ?? "https://cursor-dev.lorapok.tech";
  const SUBSCRIBE_URL = social?.api?.subscribe ?? `${ADMIN_API}/api/subscribe`;
  const NOTICE_URL = social?.api?.notice ?? `${ADMIN_API}/api/notice`;

  let data;
  try {
    const res = await fetch("site-data.json", { cache: "no-store" });
    if (!res.ok) throw new Error(res.statusText);
    data = await res.json();
  } catch {
    data = null;
  }

  if (data) {
    const setText = (sel, text) => {
      $$(sel).forEach((el) => { el.textContent = text; });
    };
    const setHref = (sel, href) => {
      $$(sel).forEach((el) => { el.href = href; });
    };

    // Core version data
    setText("[data-version]", data.version);
    setText("[data-package-version]", data.packageVersion);
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

    // Browser extension
    setText("[data-firefox-version]", data.browserExtension?.firefox?.version ?? data.version ?? "—");
    setHref("[data-href-firefox]", data.browserExtension?.firefox?.url ?? "#");
    setHref("[data-href-chrome-zip]", data.browserExtension?.chrome?.zipUrl ?? data.github?.releaseUrl ?? "#");

    // GitHub links
    setHref("[data-href-release]", data.github.releaseUrl);
    setHref("[data-href-vsix]", data.github.vsixUrl);
    setHref("[data-href-repo]", data.repository);

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

    // KPI strip — static site-data first, then live analytics API
    const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : "—");
    setText("[data-downloads-total]", fmt(data.downloads?.total));
    setText("[data-visits-total]", fmt(data.visitors?.websiteVisits));
    setText("[data-engagement-total]", fmt(data.visitors?.totalEngagement));

    const refreshLiveVisitorKpis = async () => {
      const statsUrl = social?.api?.analyticsStats ?? `${ADMIN_API}/api/analytics/stats`;
      try {
        const res = await fetch(statsUrl, { cache: "no-store" });
        if (!res.ok) return;
        const stats = await res.json();
        setText("[data-visits-total]", fmt(stats.websiteVisits));
        setText("[data-engagement-total]", fmt(stats.totalEngagement));
      } catch {
        /* keep static fallback */
      }
    };
    refreshLiveVisitorKpis();
    window.setInterval(refreshLiveVisitorKpis, 60_000);

    // OG image
    const metaOg = document.querySelector('meta[property="og:image"]');
    if (metaOg) {
      metaOg.setAttribute("content", new URL("assets/marketing/og-social-card.png", window.location.href).href);
    }

    if (!window.location.pathname.endsWith("privacy.html")) {
      document.title = `${data.displayName} v${data.version} — Live Cursor Usage Dashboard`;
    }
  }

  // Contact fallback from social.json
  if (social?.contact) {
    const primary = document.querySelector("[data-contact-primary]");
    const fallback = document.querySelector("[data-contact-fallback]");
    if (primary && social.contact.email) {
      primary.href = `mailto:${social.contact.email}`;
      if (!primary.textContent || primary.textContent === "Contact") {
        /* keep Contact label */
      }
    }
    if (fallback && social.contact.fallbackEmail) {
      fallback.href = `mailto:${social.contact.fallbackEmail}`;
      fallback.textContent = social.contact.fallbackEmail;
    }
  }

  // Admin links prefer social.api.base when present
  if (social?.api?.base) {
    document.querySelectorAll(".footer-admin").forEach((el) => {
      el.href = social.api.base;
    });
  }

  const live = await fetchLiveNotice(NOTICE_URL);
  // When the admin API is reachable, honor it even if the notice is disabled.
  // Fall back to site-data.json only when the API cannot be reached.
  const notice = live.reachable ? live.notice : data?.notice;
  renderDevNotice(notice);

  initLightbox();
  initMobileNav();
  initSubscribeForm(SUBSCRIBE_URL);
})();

async function fetchLiveNotice(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { reachable: false, notice: null };
    const notice = await res.json();
    return { reachable: true, notice: notice?.enabled ? notice : null };
  } catch {
    return { reachable: false, notice: null };
  }
}

function renderDevNotice(notice) {
  const banner = document.getElementById("dev-notice-banner");
  const content = document.getElementById("dev-notice-content");
  const dismissBtn = document.getElementById("dev-notice-dismiss");
  if (!banner || !content || !notice?.enabled) return;

  const storageKey = "ccm-dev-notice-dismissed";
  const noticeId = notice.updatedAt ?? notice.title;
  if (notice.dismissible && localStorage.getItem(storageKey) === noticeId) return;

  const links = [
    notice.feedbackUrl ? `<a href="${notice.feedbackUrl}" target="_blank" rel="noopener">Share feedback</a>` : "",
    notice.collaborateUrl ? `<a href="${notice.collaborateUrl}" target="_blank" rel="noopener">Collaborate with Lorapok Labs</a>` : "",
  ].filter(Boolean).join(" · ");

  const html = `
    <span class="notice-badge">${notice.title ?? "Notice"}</span>
    <span>${notice.shortMessage ?? notice.message}</span>
    ${links ? `<span>— ${links}</span>` : ""}
  `;

  content.innerHTML = html;
  const duplicate = banner.querySelector(".dev-notice-duplicate");
  if (duplicate) duplicate.innerHTML = html;

  banner.hidden = false;

  if (notice.dismissible && dismissBtn) {
    dismissBtn.hidden = false;
    dismissBtn.addEventListener("click", () => {
      localStorage.setItem(storageKey, noticeId);
      banner.hidden = true;
    });
  }
}

function initMobileNav() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("nav-links");
  if (!toggle || !nav) return;

  const close = () => {
    nav.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    document.body.classList.remove("nav-menu-open");
  };

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-menu-open", open);
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", close);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("nav-open")) close();
  });
}

function initSubscribeForm(subscribeUrl) {
  const form = document.getElementById("subscribe-form");
  const message = document.getElementById("subscribe-message");
  if (!form || !message) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = form.querySelector('[name="email"]');
    const email = input?.value?.trim();
    if (!email) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    message.hidden = false;
    message.textContent = "Subscribing…";
    message.className = "subscribe-message pending";

    try {
      const res = await fetch(subscribeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        message.textContent =
          body.message ||
          (body.emailed
            ? "You're subscribed! Check your inbox for a confirmation email."
            : "You're on the list. Welcome email is delayed — we'll still notify you about updates.");
        message.className = body.emailed ? "subscribe-message success" : "subscribe-message pending";
        form.reset();
      } else {
        message.textContent = body.error || "Subscription failed. Please try again later.";
        message.className = "subscribe-message error";
      }
    } catch {
      message.textContent = "Network error. Please try again later.";
      message.className = "subscribe-message error";
    } finally {
      btn.disabled = false;
    }
  });
}

function initLightbox() {
  const lightbox = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-img");
  const caption = document.getElementById("lightbox-caption");
  const counter = document.getElementById("lightbox-counter");
  if (!lightbox || !img) return;

  const allTriggers = [...document.querySelectorAll(".lightbox-trigger")];
  let activeGroup = null;
  let index = 0;
  let lastFocus = null;

  const groupFor = (btn) => btn.dataset.lightboxGroup || "page";
  const triggersInGroup = (group) => allTriggers.filter((btn) => groupFor(btn) === group);

  const show = (group, i) => {
    const triggers = triggersInGroup(group);
    if (!triggers.length) return;
    activeGroup = group;
    index = (i + triggers.length) % triggers.length;
    const btn = triggers[index];
    const src = btn.dataset.src || btn.querySelector("img")?.currentSrc || btn.querySelector("img")?.src;
    const alt = btn.querySelector("img")?.alt || btn.dataset.caption || "";
    if (!src) return;

    img.classList.remove("is-loaded");
    const onLoad = () => {
      img.classList.add("is-loaded");
      img.removeEventListener("load", onLoad);
    };
    img.addEventListener("load", onLoad);
    img.src = src;
    if (img.complete) onLoad();
    img.alt = alt;
    caption.textContent = btn.dataset.caption || alt;
    counter.textContent = `${index + 1} / ${triggers.length}`;
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    lightbox.querySelector(".lightbox-close")?.focus();
  };

  const close = () => {
    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    img.classList.remove("is-loaded");
    img.removeAttribute("src");
    activeGroup = null;
    lastFocus?.focus?.();
    lastFocus = null;
  };

  allTriggers.forEach((btn) => {
    btn.addEventListener("click", () => {
      lastFocus = btn;
      const group = groupFor(btn);
      const triggers = triggersInGroup(group);
      show(group, triggers.indexOf(btn));
    });
  });

  lightbox.querySelectorAll("[data-lightbox-close]").forEach((el) => {
    el.addEventListener("click", close);
  });

  lightbox.querySelector(".lightbox-prev")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (activeGroup) show(activeGroup, index - 1);
  });

  lightbox.querySelector(".lightbox-next")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (activeGroup) show(activeGroup, index + 1);
  });

  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden || !activeGroup) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(activeGroup, index - 1);
    if (e.key === "ArrowRight") show(activeGroup, index + 1);
  });
}
