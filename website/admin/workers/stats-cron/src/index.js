/**
 * Calls Mission Control cron endpoint on a schedule (every minute; server enforces interval).
 */
export default {
  async scheduled(_event, env) {
    const base = (env.ADMIN_PUBLIC_URL ?? "https://cursor-dev.lorapok.tech").replace(/\/$/, "");
    const secret = typeof env.CRON_SECRET === "string" ? env.CRON_SECRET.trim() : "";
    if (!secret) {
      console.warn("ccm-stats-cron: CRON_SECRET not set — skipping");
      return;
    }

    const res = await fetch(`${base}/api/cron/stats-refresh`, {
      method: "POST",
      headers: {
        "X-Cron-Secret": secret,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`ccm-stats-cron: ${res.status} ${text.slice(0, 200)}`);
    }
  },
};
