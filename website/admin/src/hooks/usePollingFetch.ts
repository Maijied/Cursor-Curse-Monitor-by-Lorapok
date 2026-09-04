import { useCallback, useEffect, useState } from "react";

type UsePollingFetchOptions = {
  /** Poll interval in ms; 0 disables polling */
  intervalMs?: number;
  enabled?: boolean;
};

/**
 * Fetch on mount, on manual refresh, and at a fixed interval.
 */
export function usePollingFetch<T>(
  fetcher: () => Promise<T>,
  { intervalMs = 60_000, enabled = true }: UsePollingFetchOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Request failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, tick, enabled]);

  useEffect(() => {
    if (!enabled || !intervalMs || intervalMs <= 0) return;
    const id = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);

  return { data, error, loading, refresh };
}
