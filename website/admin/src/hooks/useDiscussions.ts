import { useEffect, useState } from "react";
import { fetchDiscussionsApi, type DiscussionResponse } from "../lib/api";
import { auth } from "../lib/firebase";

export type DiscussionData = DiscussionResponse;

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export function useDiscussions(fallback?: DiscussionData) {
  const [data, setData] = useState<DiscussionData | null>(fallback ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!fallback);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const user = auth.currentUser;
        if (user) {
          const json = await fetchDiscussionsApi();
          if (!cancelled) {
            setData({
              ...json,
              categories: json.categories ?? [],
              capabilities: json.capabilities ?? {
                canCreatePosts: false,
                canManageCategories: false,
                canCreatePolls: false,
                tokenConfigured: false,
              },
            });
            setError(null);
          }
          return;
        }
        const res = await fetch(`${API_BASE}/discussions`);
        if (!res.ok) throw new Error("Failed to load discussions");
        const json = await res.json();
        if (!cancelled) {
          setData({
            ...json,
            categories: json.categories ?? [],
            capabilities: json.capabilities ?? {
              canCreatePosts: false,
              canManageCategories: false,
              canCreatePolls: false,
              tokenConfigured: false,
            },
          });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          if (fallback) setData(fallback);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fallback, tick]);

  return {
    data,
    error,
    loading,
    refresh: () => {
      setLoading(true);
      setTick((t) => t + 1);
    },
  };
}
