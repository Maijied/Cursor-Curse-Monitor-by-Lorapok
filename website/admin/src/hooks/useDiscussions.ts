import { useEffect, useState } from "react";
import { auth } from "../lib/firebase";

export type DiscussionData = {
  enabled: boolean;
  discussions: Array<{
    title: string;
    url: string;
    category: string;
    createdAt: string;
    comments: number;
    answered?: boolean;
  }>;
  topics: Array<{
    topic: string;
    count: number;
    items: Array<{ title: string; url: string; state?: string; comments?: number; updatedAt?: string }>;
  }>;
  settingsUrl: string;
  repoIssuesUrl: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export function useDiscussions(fallback?: DiscussionData) {
  const [data, setData] = useState<DiscussionData | null>(fallback ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!fallback);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const user = auth.currentUser;
        const headers: Record<string, string> = {};
        if (user) {
          headers.Authorization = `Bearer ${await user.getIdToken()}`;
        }
        const res = await fetch(`${API_BASE}/discussions`, { headers });
        if (!res.ok) throw new Error("Failed to load discussions");
        const json = await res.json();
        if (!cancelled) {
          setData(json);
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
    return () => { cancelled = true; };
  }, [fallback]);

  return { data, error, loading };
}
