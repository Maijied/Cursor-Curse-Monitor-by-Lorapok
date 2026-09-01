/**
 * Renders Lorapok social footer links from website/social.json.
 * Used on index, privacy, and terms pages.
 */
(function () {
  /** @type {Record<string, { label: string; svg: string; className?: string }>} */
  const ICONS = {
    github: {
      label: "GitHub",
      svg: '<path fill="currentColor" d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.178 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.021C22 6.484 17.522 2 12 2z"/>',
    },
    discord: {
      label: "Discord",
      svg: '<path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>',
    },
    linkedin: {
      label: "LinkedIn",
      svg: '<path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 4.126 0 2.064 2.064 0 0 1-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
    },
    x: {
      label: "X",
      svg: '<path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
    },
    reddit: {
      label: "Reddit",
      svg: '<path fill="currentColor" d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>',
    },
    instagram: {
      label: "Instagram",
      svg: '<path fill="currentColor" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>',
    },
    facebook: {
      label: "Facebook",
      svg: '<path fill="currentColor" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>',
    },
    labs: {
      label: "Lorapok Labs",
      svg: '<path fill="currentColor" d="M12 1L1 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-11-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-2.54v8.23z"/>',
    },
    gravatar: {
      label: "Gravatar",
      svg: '<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 0 1-6 3.22z"/>',
    },
    admin: {
      label: "Mission Control admin panel",
      className: "footer-admin",
      svg: '<path fill="currentColor" d="M12 1.75 3.5 5.5v5.75c0 4.86 3.34 9.41 8.5 10.75 5.16-1.34 8.5-5.89 8.5-10.75V5.5L12 1.75zm0 2.2 6.5 2.86v4.44c0 3.84-2.62 7.45-6.5 8.72-3.88-1.27-6.5-4.88-6.5-8.72V6.81L12 3.95zM11 8v4.59l3.3 1.9.7-1.22-2.5-1.44V8h-1.5z"/>',
    },
  };

  /** @type {readonly { key: string; source: "brand" | "community"; icon: string }[]} */
  const FULL_ORDER = [
    { key: "github", source: "brand", icon: "github" },
    { key: "discord", source: "community", icon: "discord" },
    { key: "linkedin", source: "brand", icon: "linkedin" },
    { key: "x", source: "brand", icon: "x" },
    { key: "reddit", source: "brand", icon: "reddit" },
    { key: "instagram", source: "brand", icon: "instagram" },
    { key: "facebook", source: "brand", icon: "facebook" },
    { key: "labs", source: "brand", icon: "labs" },
    { key: "gravatar", source: "brand", icon: "gravatar" },
  ];

  /** @type {readonly { key: string; source: "brand" | "community"; icon: string }[]} */
  const MINIMAL_ORDER = [
    { key: "github", source: "brand", icon: "github" },
    { key: "discord", source: "community", icon: "discord" },
    { key: "labs", source: "brand", icon: "labs" },
  ];

  /**
   * @param {string} href
   * @param {{ label: string; svg: string; className?: string }} icon
   */
  function linkHtml(href, icon) {
    const cls = icon.className ? ` class="${icon.className}"` : "";
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${icon.label}" title="${icon.label}"${cls}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${icon.svg}</svg>
    </a>`;
  }

  /**
   * @param {HTMLElement} nav
   * @param {Record<string, unknown>} social
   */
  function renderNav(nav, social) {
    const brand = /** @type {Record<string, string>} */ (social.brand ?? {});
    const community = /** @type {Record<string, string>} */ (social.community ?? {});
    const api = /** @type {Record<string, string>} */ (social.api ?? {});
    const mode = nav.dataset.footerSocial || "full";
    const order = mode === "minimal" ? MINIMAL_ORDER : FULL_ORDER;

    const parts = [];
    for (const item of order) {
      const href =
        item.source === "community" ? community[item.key] : brand[item.key === "labs" ? "labs" : item.key];
      if (!href) continue;
      const icon = ICONS[item.icon];
      if (!icon) continue;
      parts.push(linkHtml(href, icon));
    }

    if (mode !== "minimal" && api.base) {
      parts.push('<span class="footer-social-divider" aria-hidden="true"></span>');
      parts.push(linkHtml(api.base, ICONS.admin));
    }

    nav.innerHTML = parts.join("\n        ");
  }

  /**
   * @param {Record<string, unknown>} social
   */
  function applyContactLinks(social) {
    const contact = /** @type {Record<string, string>} */ (social.contact ?? {});
    document.querySelectorAll("[data-contact-primary]").forEach((el) => {
      if (contact.email && el instanceof HTMLAnchorElement) el.href = `mailto:${contact.email}`;
    });
    document.querySelectorAll("[data-contact-fallback]").forEach((el) => {
      if (contact.fallbackEmail && el instanceof HTMLAnchorElement) {
        el.href = `mailto:${contact.fallbackEmail}`;
        el.textContent = contact.fallbackEmail;
      }
    });
  }

  async function init() {
    const navs = [...document.querySelectorAll("[data-footer-social]")];
    if (!navs.length) return;

    let social = null;
    try {
      const res = await fetch("social.json", { cache: "no-store" });
      if (res.ok) social = await res.json();
    } catch {
      /* static fallbacks in HTML */
    }

    if (!social) return;

    for (const nav of navs) {
      if (nav instanceof HTMLElement) renderNav(nav, social);
    }
    applyContactLinks(social);
    document.dispatchEvent(new CustomEvent("ccm-social-ready", { detail: social }));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
