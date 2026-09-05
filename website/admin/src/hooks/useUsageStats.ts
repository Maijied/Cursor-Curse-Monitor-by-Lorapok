import { useEffect, useState } from "react";
import { fetchUsageStatsApi, type UsageStatsResponse } from "../lib/api";

export function useUsageStats() {
  const [stats, setStats] = useState<UsageStatsResponse | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchUsageStatsApi()
        .then((data) => {
          if (cancelled) return;
          setStats(data);
          setLive(true);
          setError(null);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setLive(false);
            setError(err instanceof Error ? err.message : "Usage stats unavailable");
          }
        });
    };
    load();
    const id = window.setInterval(load, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return { stats, live, error };
}
