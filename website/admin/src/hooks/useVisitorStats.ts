import { useEffect, useState } from "react";
import { fetchAnalyticsStatsApi } from "../lib/api";
import type { VisitorStats } from "../lib/site-data";

const DEFAULT: VisitorStats = {
  websiteVisits: 0,
  packageClicks: { ovsx: 0, vscode: 0, github: 0, vsix: 0, npm: 0, openvsxDuplicate: 0 },
  totalEngagement: 0,
  updatedAt: null,
};

export function useVisitorStats(fallback?: VisitorStats) {
  const [stats, setStats] = useState<VisitorStats>(fallback ?? DEFAULT);
  const [live, setLive] = useState(false);
  const fallbackKey = fallback ? JSON.stringify(fallback) : "";

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchAnalyticsStatsApi()
        .then((data) => {
          if (cancelled) return;
          setStats({
            websiteVisits: data.websiteVisits ?? 0,
            packageClicks: {
              ovsx: 0,
              vscode: 0,
              github: 0,
              vsix: 0,
              npm: 0,
              openvsxDuplicate: 0,
              ...(data.packageClicks ?? {}),
            },
            totalEngagement: data.totalEngagement ?? 0,
            updatedAt: data.updatedAt ?? null,
          });
          setLive(true);
        })
        .catch(() => {
          if (!cancelled) {
            if (fallback) setStats(fallback);
            setLive(false);
          }
        });
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fallbackKey]);

  return { stats, live };
}
