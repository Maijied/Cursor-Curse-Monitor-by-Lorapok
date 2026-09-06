import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeSiteData, type SiteData } from "../lib/site-data";

function siteDataCandidates(): string[] {
  const preferred = import.meta.env.VITE_SITE_DATA_URL as string | undefined;
  return [...new Set([preferred, "/api/site-data", "/site-data.json"].filter((url): url is string => Boolean(url)))];
}

/**
 * Load live marketing site-data when possible so Mission Control totals match the public site.
 * Falls back to the baked-in /site-data.json copy from the last admin build.
 */
async function loadSiteData(cacheBust?: number): Promise<SiteData> {
  let lastError: Error | null = null;
  for (const url of siteDataCandidates()) {
    try {
      const requestUrl =
        cacheBust && url === "/api/site-data" ? `${url}?t=${cacheBust}` : url;
      const res = await fetch(requestUrl, { cache: "no-store" });
      if (!res.ok) {
        lastError = new Error(`Failed to load site data (${res.status})`);
        continue;
      }
      return normalizeSiteData((await res.json()) as SiteData);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Failed to load site data");
    }
  }
  throw lastError ?? new Error("Failed to load site data");
}

type UseSiteDataOptions = {
  /** Poll interval in ms; default 60s. Set 0 to disable. */
  pollIntervalMs?: number;
};

export function useSiteData(options: UseSiteDataOptions = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? 60_000;
  const [data, setData] = useState<SiteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const manualRefreshRef = useRef(false);

  const refresh = useCallback(() => {
    manualRefreshRef.current = true;
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cacheBust = manualRefreshRef.current ? Date.now() : undefined;
    manualRefreshRef.current = false;
    setLoading(true);
    loadSiteData(cacheBust)
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Failed to load site data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    const id = window.setInterval(() => setTick((value) => value + 1), pollIntervalMs);
    return () => window.clearInterval(id);
  }, [pollIntervalMs]);

  return { data, error, loading, refresh };
}
