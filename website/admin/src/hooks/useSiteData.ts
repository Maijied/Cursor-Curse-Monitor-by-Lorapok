import { useEffect, useState } from "react";
import type { SiteData } from "../lib/site-data";

export function useSiteData() {
  const [data, setData] = useState<SiteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const siteDataUrl = import.meta.env.VITE_SITE_DATA_URL || "/site-data.json";
    fetch(siteDataUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load site data");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load site data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { data, error, loading, refresh: () => setLoading(true) };
}
