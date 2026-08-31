import { useEffect, useState } from "react";
import { normalizeSiteData, type SiteData } from "../lib/site-data";

function siteDataCandidates(): string[] {
  const preferred = import.meta.env.VITE_SITE_DATA_URL as string | undefined;
  return [...new Set([preferred, "/api/site-data", "/site-data.json"].filter((url): url is string => Boolean(url)))];
}

/**
 * Load live marketing site-data when possible so Mission Control totals match the public site.
 * Falls back to the baked-in /site-data.json copy from the last admin build.
 */
async function loadSiteData(): Promise<SiteData> {
  let lastError: Error | null = null;
  for (const url of siteDataCandidates()) {
    try {
      const res = await fetch(url, { cache: "no-store" });
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

export function useSiteData() {
  const [data, setData] = useState<SiteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadSiteData()
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
    return () => { cancelled = true; };
  }, []);

  return { data, error, loading, refresh: () => setLoading(true) };
}
