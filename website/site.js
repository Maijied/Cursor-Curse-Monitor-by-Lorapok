/**
 * Loads site-data.json and powers dynamic install UI + photo lightbox.
 * Supports both Open VSX and VS Code Marketplace data.
 */
(async function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const NOTICE_URL = "https://cursor-dev.lorapok.tech/api/notice";
  const FALLBACK_NOTICE = {
    enabled: true,
    id: "rollback-recovery-fallback",
    title: "Rollback and Recovery Notice",
    shortMessage:
      "We’re extremely sorry — an immediate rollback is in progress to restore stability. We’ll update you as soon as recovery is confirmed.",
    message:
      "We’re extremely sorry for the disruption. We have initiated an immediate rollback to restore the last stable version while we investigate the issue.",
    severity: "warning",
    dismissible: false,
    feedbackUrl: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues",
    collaborateUrl: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/discussions",
  };

  // Register local interactions before any network request. A slow data or
  // notice request must never make image previews feel unresponsive.
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

  if (data) {
    const setText = (sel, text) => {
      $$(sel).forEach((el) => { el.textContent = text; });
    };
    const setHref = (sel, href) => {
      $$(sel).forEach((el) => { el.href = href; });
    };
    const fmt = (n) => (n == null || Number.isNaN(Number(n)) ? "—" : Number(n).toLocaleString());

    // KPI strip (downloads + engagement)
    setText("[data-downloads-total]", fmt(data.downloads?.total));
    setText("[data-visits-total]", fmt(data.visitors?.websiteVisits));
    setText("[data-engagement-total]", fmt(data.visitors?.totalEngagement));

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

    // GitHub links
    setHref("[data-href-release]", data.github.releaseUrl);
    setHref("[data-href-vsix]", data.github.vsixUrl);
    setHref("[data-href-repo]", data.repository);
    setHref("[data-href-firefox]", data.browserExtension?.firefox?.url ?? "https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor-by-lorapok/");
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

  async function initNotice() {
    const banner = $("#dev-notice-banner");
    const content = $("#dev-notice-content");
    const duplicate = $(".dev-notice-duplicate");
    const dismiss = $("#dev-notice-dismiss");
    if (!banner || !content) return;

    let notice = FALLBACK_NOTICE;
    try {
      const response = await fetch(NOTICE_URL, { cache: "no-store" });
      if (response.ok) {
        const live = await response.json();
        if (live?.enabled && live.title && (live.shortMessage || live.message)) notice = live;
        else if (!live?.enabled) return;
      }
    } catch {
      // Keep the recovery message visible when the admin API is unavailable.
    }

    const dismissedKey = `ccm-notice-dismissed:${notice.id || notice.title}`;
    if (notice.dismissible && window.localStorage.getItem(dismissedKey) === "1") return;

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
    if (duplicate) duplicate.replaceChildren(buildContent());
    banner.hidden = false;
    banner.setAttribute("aria-label", notice.title);
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
 * Initializes ecosystem tabs with accessible panel switching and automatic cycling.
 */
function initEcosystemTabs() {
  const tabs = [...document.querySelectorAll("[data-ecosystem-tab]")];
  const panels = [...document.querySelectorAll("[data-ecosystem-panel]")];
  if (!tabs.length || !panels.length) return;

  const activate = (id) => {
    tabs.forEach((tab) => {
      const on = tab.dataset.ecosystemTab === id;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach((panel) => {
      const on = panel.dataset.ecosystemPanel === id;
      panel.classList.toggle("active", on);
      panel.hidden = !on;
    });
  };

  let rotationActive = true;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      rotationActive = false;
      activate(tab.dataset.ecosystemTab || "ide");
    });
  });

  let i = 0;
  const ids = tabs.map((t) => t.dataset.ecosystemTab).filter(Boolean);
  setInterval(() => {
    if (document.hidden || !ids.length || !rotationActive) return;
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

  const triggers = [...document.querySelectorAll(".lightbox-trigger")];
  let index = 0;

  const show = (i) => {
    if (!triggers.length) return;
    index = (i + triggers.length) % triggers.length;
    const btn = triggers[index];
    const src = btn.dataset.src || btn.querySelector("img")?.src;
    const alt = btn.querySelector("img")?.alt || btn.dataset.caption || "";
    if (!src) return;

    img.src = src;
    img.alt = alt;
    caption.textContent = btn.dataset.caption || alt;
    counter.textContent = `${index + 1} / ${triggers.length}`;
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    lightbox.querySelector(".lightbox-close")?.focus();
  };

  const close = () => {
    lightbox.hidden = true;
    document.body.classList.remove("lightbox-open");
    img.removeAttribute("src");
  };

  triggers.forEach((btn, i) => {
    btn.addEventListener("click", () => show(i));
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
}
