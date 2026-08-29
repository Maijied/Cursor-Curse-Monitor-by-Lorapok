/**
 * Calls Mission Control cron endpoints on a schedule (every minute; server enforces intervals).
 */
export default {
  async scheduled(_event, env) {
    const base = (env.ADMIN_PUBLIC_URL ?? "https://cursor-dev.lorapok.tech").replace(/\/$/, "");
    const secret = typeof env.CRON_SECRET === "string" ? env.CRON_SECRET.trim() : "";
    if (!secret) {
      console.warn("ccm-stats-cron: CRON_SECRET not set — skipping");
      return;
    }

    const headers = {
      "X-Cron-Secret": secret,
      Accept: "application/json",
    };

    const endpoints = ["/api/cron/stats-refresh", "/api/cron/discord-digest"];

    await Promise.all(
      endpoints.map(async (path) => {
        const res = await fetch(`${base}${path}`, { method: "POST", headers });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(`ccm-stats-cron ${path}: ${res.status} ${text.slice(0, 200)}`);
        }
      })
    );
  },
};
