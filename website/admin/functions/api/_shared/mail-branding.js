const SITE_BASE =
  typeof process !== "undefined" && process.env?.SITE_BASE_URL
    ? process.env.SITE_BASE_URL.replace(/\/$/, "")
    : "https://cursor.lorapok.tech";

const MAIN_LOGO_URL = `${SITE_BASE}/assets/logo.png`;

/** @type {Record<string, { logoUrl: string; accentColor: string; badgeLabel: string; barGradient: string }>} */
export const MAIL_BRANDING = {
  subscribe: {
    logoUrl: MAIN_LOGO_URL,
    accentColor: "#7c5cff",
    badgeLabel: "CCM",
    barGradient: "linear-gradient(90deg,#7c5cff,#4d9fff,#34d399,#7c5cff)",
  },
  notice: {
    logoUrl: MAIN_LOGO_URL,
    accentColor: "#fbbf24",
    badgeLabel: "Alert",
    barGradient: "linear-gradient(90deg,#fbbf24,#ff6b6b,#7c5cff,#fbbf24)",
  },
  test: {
    logoUrl: MAIN_LOGO_URL,
    accentColor: "#34d399",
    badgeLabel: "Test",
    barGradient: "linear-gradient(90deg,#34d399,#4d9fff,#7c5cff,#34d399)",
  },
  compose: {
    logoUrl: MAIN_LOGO_URL,
    accentColor: "#4d9fff",
    badgeLabel: "CCM",
    barGradient: "linear-gradient(90deg,#4d9fff,#7c5cff,#34d399,#4d9fff)",
  },
  invite: {
    logoUrl: MAIN_LOGO_URL,
    accentColor: "#7c5cff",
    badgeLabel: "Invite",
    barGradient: "linear-gradient(90deg,#7c5cff,#a78bfa,#4d9fff,#7c5cff)",
  },
  help: {
    logoUrl: MAIN_LOGO_URL,
    accentColor: "#2dd4bf",
    badgeLabel: "Help",
    barGradient: "linear-gradient(90deg,#2dd4bf,#4d9fff,#7c5cff,#2dd4bf)",
  },
  support: {
    logoUrl: MAIN_LOGO_URL,
    accentColor: "#2dd4bf",
    badgeLabel: "Support",
    barGradient: "linear-gradient(90deg,#2dd4bf,#4d9fff,#7c5cff,#2dd4bf)",
  },
  bugfix: {
    logoUrl: MAIN_LOGO_URL,
    accentColor: "#4d9fff",
    badgeLabel: "Bug fix",
    barGradient: "linear-gradient(90deg,#4d9fff,#7c5cff,#34d399,#4d9fff)",
  },
  feature: {
    logoUrl: MAIN_LOGO_URL,
    accentColor: "#34d399",
    badgeLabel: "New",
    barGradient: "linear-gradient(90deg,#34d399,#4d9fff,#7c5cff,#34d399)",
  },
  response: {
    logoUrl: MAIN_LOGO_URL,
    accentColor: "#2dd4bf",
    badgeLabel: "Reply",
    barGradient: "linear-gradient(90deg,#2dd4bf,#4d9fff,#7c5cff,#2dd4bf)",
  },
  warning: {
    logoUrl: MAIN_LOGO_URL,
    accentColor: "#fbbf24",
    badgeLabel: "Warning",
    barGradient: "linear-gradient(90deg,#fbbf24,#ff6b6b,#7c5cff,#fbbf24)",
  },
};

/**
 * @param {string} [category]
 * @param {{ severity?: string }} [options]
 */
export function resolveMailBranding(category = "system", { severity } = {}) {
  const key = String(category || "system").toLowerCase();
  if (severity === "critical" || severity === "error" || severity === "warning") {
    return MAIL_BRANDING.warning;
  }
  return MAIL_BRANDING[key] ?? MAIL_BRANDING.system;
}
