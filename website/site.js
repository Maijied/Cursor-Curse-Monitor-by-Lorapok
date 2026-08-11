/**
 * Loads site-data.json and powers dynamic install UI + photo lightbox.
 */
(async function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

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

    setText("[data-version]", data.version);
    setText("[data-package-version]", data.packageVersion);
    setText("[data-extension-id]", data.extensionId);
    setText("[data-ovsx-version]", data.ovsx.version ?? "—");
    setText("[data-github-tag]", data.github.releaseTag);
    setText("[data-vsix-name]", data.github.vsixName);
    setText("[data-generated]", new Date(data.generatedAt).toLocaleString());

    setHref("[data-href-ovsx]", data.ovsx.url);
    setHref("[data-href-release]", data.github.releaseUrl);
    setHref("[data-href-vsix]", data.github.vsixUrl);
    setHref("[data-href-repo]", data.repository);

    const cmd = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    cmd("cmd-vsix", data.install.vsixCommand);
    cmd("cmd-release-patch", data.install.releasePatch);
    cmd("cmd-release-minor", data.install.releaseMinor);
    cmd("cmd-ovsx-search", data.install.ovsxSearch);

    const ovsxBadge = $("#ovsx-status");
    if (ovsxBadge && data.ovsx.version) {
      ovsxBadge.textContent = data.ovsx.downloadable
        ? `Open VSX v${data.ovsx.version} · live`
        : `Open VSX v${data.ovsx.version} · syncing`;
      ovsxBadge.classList.add(data.ovsx.downloadable ? "live" : "pending");
    }

    const metaOg = document.querySelector('meta[property="og:image"]');
    if (metaOg) {
      metaOg.setAttribute("content", new URL("assets/marketing/og-social-card.png", window.location.href).href);
    }

    document.title = `${data.displayName} v${data.version} — Live Cursor Usage Dashboard`;
  }

  initLightbox();
})();

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
