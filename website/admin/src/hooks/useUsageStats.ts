import { useEffect, useState } from "react";
import { fetchUsageStatsApi, type UsageStatsResponse } from "../lib/api";

export function useUsageStats() {
  const [stats, setStats] = useState<UsageStatsResponse | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchUsageStatsApi()
        .then((data) => {
          if (cancelled) return;
          setStats(data);
          setLive(true);
        })
        .catch(() => {
          if (!cancelled) setLive(false);
        });
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return { stats, live };
}
