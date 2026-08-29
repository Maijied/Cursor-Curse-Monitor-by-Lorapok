/**
 * Lorapok UI feedback — larvae button loaders + animated status banners.
 * Loaded before site.js; exposes window.CcmUi.
 */
(function initCcmUi(global) {
  const LARVAE_VIEWBOX = "0 0 64 88";

  const FEEDBACK_COPY = {
    success: { title: "Success", defaultMessage: "Done." },
    error: { title: "Something went wrong", defaultMessage: "Please try again." },
    pending: { title: "Working on it", defaultMessage: "Please wait…" },
    info: { title: "Notice", defaultMessage: "" },
    warning: { title: "Heads up", defaultMessage: "" },
  };

  function larvaeSvg(width) {
    const height = Math.round(width * 1.35);
    return `<svg width="${width}" height="${height}" viewBox="${LARVAE_VIEWBOX}" fill="none" xmlns="http://www.w3.org/2000/svg" class="larvae-loader-root" aria-hidden="true">
      <ellipse class="larvae-trail" cx="32" cy="82" rx="18" ry="4" fill="#39ff14" opacity="0.2"></ellipse>
      <g class="larvae-leg-left"><path d="M22 72 L16 82 M28 76 L22 86" stroke="#5b9dff" stroke-width="2.2" stroke-linecap="round" opacity="0.75"></path></g>
      <g class="larvae-leg-right"><path d="M42 72 L48 82 M36 76 L42 86" stroke="#5b9dff" stroke-width="2.2" stroke-linecap="round" opacity="0.75"></path></g>
      <ellipse class="larvae-segment larvae-segment-3" cx="32" cy="62" rx="22" ry="14" fill="#2d3748" stroke="#4a5568" stroke-width="1"></ellipse>
      <ellipse class="larvae-segment larvae-segment-2" cx="32" cy="46" rx="19" ry="13" fill="#374151" stroke="#4a5568" stroke-width="1"></ellipse>
      <ellipse class="larvae-segment larvae-segment-1" cx="32" cy="32" rx="16" ry="12" fill="#3d4a5c" stroke="#5b9dff" stroke-width="0.8"></ellipse>
      <path d="M24 38 Q32 44 40 38" stroke="#39ff14" stroke-width="2.2" stroke-linecap="round" opacity="0.8"></path>
      <ellipse cx="26" cy="28" rx="7" ry="8" fill="#0a0e14" stroke="#39ff14" stroke-width="0.8"></ellipse>
      <ellipse cx="38" cy="28" rx="7" ry="8" fill="#0a0e14" stroke="#39ff14" stroke-width="0.8"></ellipse>
      <circle class="larvae-eye" cx="26" cy="28" r="4.5" fill="#39ff14"></circle>
      <circle class="larvae-eye larvae-eye-right" cx="38" cy="28" r="4.5" fill="#39ff14"></circle>
      <circle cx="24.5" cy="26.5" r="1.2" fill="white" opacity="0.9"></circle>
      <circle cx="36.5" cy="26.5" r="1.2" fill="white" opacity="0.9"></circle>
    </svg>`;
  }

  function statusIconSvg(tone) {
    if (tone === "pending") return larvaeSvg(22);
    if (tone === "success") {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.35"></circle><path class="ccm-feedback-check" d="M7.5 12.2l2.8 2.8 6.2-6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
    }
    if (tone === "error") {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.35"></circle><path d="M12 8v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><circle cx="12" cy="16.5" r="1" fill="currentColor"></circle></svg>`;
    }
    if (tone === "warning") {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5L2.5 19.5h19L12 3.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path><path d="M12 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><circle cx="12" cy="17" r="1" fill="currentColor"></circle></svg>`;
    }
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.35"></circle><path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><circle cx="12" cy="8" r="1" fill="currentColor"></circle></svg>`;
  }

  function populateLoaderSlot(slot) {
    if (!slot || slot.dataset.larvaeReady === "1") return;
    slot.innerHTML = larvaeSvg(20);
    slot.dataset.larvaeReady = "1";
  }

  function initButtonLoaders(root = global.document) {
    root.querySelectorAll(".btn-larvae-loader, .subscribe-btn-loader").forEach(populateLoaderSlot);
  }

  function setButtonLoading(button, loading) {
    if (!button) return;
    const loader = button.querySelector(".btn-larvae-loader, .subscribe-btn-loader");
    if (loader) populateLoaderSlot(loader);
    button.disabled = Boolean(loading);
    button.classList.toggle("is-loading", Boolean(loading));
    button.setAttribute("aria-busy", loading ? "true" : "false");
    if (loader) loader.hidden = !loading;
  }

  function showFeedback(el, { tone = "info", title, message } = {}) {
    if (!el) return;
    const copy = FEEDBACK_COPY[tone] || FEEDBACK_COPY.info;
    const resolvedTitle = title ?? (tone === "pending" || tone === "success" || tone === "error" ? undefined : copy.title);
    const resolvedMessage = message ?? copy.defaultMessage;

    el.hidden = false;
    el.className = `ccm-feedback ccm-feedback--${tone}`;
    el.setAttribute("role", tone === "error" ? "alert" : "status");

    const titleHtml = resolvedTitle
      ? `<strong class="ccm-feedback-title">${escapeHtml(resolvedTitle)}</strong>`
      : "";
    const messageHtml = resolvedMessage
      ? `<span class="ccm-feedback-text">${escapeHtml(resolvedMessage)}</span>`
      : "";

    el.innerHTML = `
      <span class="ccm-feedback-icon">${statusIconSvg(tone)}</span>
      <span class="ccm-feedback-copy">
        ${titleHtml}
        ${messageHtml}
      </span>
    `;

    el.classList.remove("ccm-feedback--visible");
    void el.offsetWidth;
    el.classList.add("ccm-feedback--visible");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  global.CcmUi = {
    larvaeSvg,
    initButtonLoaders,
    setButtonLoading,
    showFeedback,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", () => initButtonLoaders());
  } else {
    initButtonLoaders();
  }
})(window);
