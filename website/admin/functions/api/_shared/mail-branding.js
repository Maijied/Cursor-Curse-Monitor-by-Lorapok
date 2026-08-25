const SITE_BASE =
  typeof process !== "undefined" && process.env?.SITE_BASE_URL
    ? process.env.SITE_BASE_URL.replace(/\/$/, "")
    : "https://cursor.lorapok.tech";
/** @type {Record<string, { logoUrl: string; accentColor: string; badgeLabel: string; barGradient: string }>} */
export const MAIL_BRANDING = {
  subscribe: {
    logoUrl: `${SITE_BASE}/assets/mail/logo-product.png`,
    accentColor: "#7c5cff",
    badgeLabel: "CCM",
    barGradient: "linear-gradient(90deg,#7c5cff,#4d9fff,#34d399,#7c5cff)",
  },
  notice: {
    logoUrl: `${SITE_BASE}/assets/mail/logo-notice.png`,
    accentColor: "#fbbf24",
    badgeLabel: "Alert",
    barGradient: "linear-gradient(90deg,#fbbf24,#ff6b6b,#7c5cff,#fbbf24)",
  },
  test: {
    logoUrl: `${SITE_BASE}/assets/mail/logo-product.png`,
    accentColor: "#34d399",
    badgeLabel: "Test",
    barGradient: "linear-gradient(90deg,#34d399,#4d9fff,#7c5cff,#34d399)",
  },
  compose: {
    logoUrl: `${SITE_BASE}/assets/mail/logo-product.png`,
    accentColor: "#4d9fff",
    badgeLabel: "CCM",
    barGradient: "linear-gradient(90deg,#4d9fff,#7c5cff,#34d399,#4d9fff)",
  },
  invite: {
    logoUrl: `${SITE_BASE}/assets/mail/logo-product.png`,
    accentColor: "#7c5cff",
    badgeLabel: "Invite",
    barGradient: "linear-gradient(90deg,#7c5cff,#a78bfa,#4d9fff,#7c5cff)",
  },
  help: {
    logoUrl: `${SITE_BASE}/assets/mail/logo-help.png`,
    accentColor: "#2dd4bf",
    badgeLabel: "Help",
    barGradient: "linear-gradient(90deg,#2dd4bf,#4d9fff,#7c5cff,#2dd4bf)",
  },
  support: {
    logoUrl: `${SITE_BASE}/assets/mail/logo-help.png`,
    accentColor: "#2dd4bf",
    badgeLabel: "Support",
    barGradient: "linear-gradient(90deg,#2dd4bf,#4d9fff,#7c5cff,#2dd4bf)",
  },
  system: {
    logoUrl: `${SITE_BASE}/assets/mail/logo-product.png`,
    accentColor: "#7c5cff",
    badgeLabel: "CCM",
    barGradient: "linear-gradient(90deg,#7c5cff,#4d9fff,#34d399,#7c5cff)",
  },
};

/**
 * @param {string} [category]
 * @param {{ severity?: string }} [opts]
 */
export function resolveMailBranding(category = "system", opts = {}) {
  const key = String(category || "system").toLowerCase();
  const base = MAIL_BRANDING[key] ?? MAIL_BRANDING.system;
  if (key === "notice" && opts.severity === "critical") {
    return {
      ...base,
      accentColor: "#ff6b6b",
      badgeLabel: "Critical",
      barGradient: "linear-gradient(90deg,#ff6b6b,#fbbf24,#7c5cff,#ff6b6b)",
    };
  }
  if (key === "notice" && opts.severity === "warning") {
    return { ...base, accentColor: "#fbbf24", badgeLabel: "Warning" };
  }
  return base;
}
