import { useEffect, useState } from "react";
import type { SiteData } from "../lib/site-data";

const SITE_DATA_URL = import.meta.env.VITE_SITE_DATA_URL || "/site-data.json";

export function useSiteData() {
  const [data, setData] = useState<SiteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(SITE_DATA_URL)
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
