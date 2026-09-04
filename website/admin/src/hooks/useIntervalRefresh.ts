import { useCallback } from "react";
import { useEffect } from "react";

/**
 * Re-runs a callback on a fixed interval (integration cards, health polls).
 */
export function useIntervalRefresh(callback: () => void, intervalMs = 60_000, enabled = true) {
  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    const id = window.setInterval(callback, intervalMs);
    return () => window.clearInterval(id);
  }, [callback, intervalMs, enabled]);
}

/**
 * Stable callback wrapper for polling loaders.
 */
export function usePollLoader(load: () => void, intervalMs = 60_000) {
  const stableLoad = useCallback(load, [load]);
  useIntervalRefresh(stableLoad, intervalMs);
}
