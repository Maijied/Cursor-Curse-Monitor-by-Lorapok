import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { VisitorStats } from "../lib/site-data";

const DEFAULT: VisitorStats = {
  websiteVisits: 0,
  packageClicks: { ovsx: 0, vscode: 0, github: 0, vsix: 0, openvsxDuplicate: 0 },
  totalEngagement: 0,
  updatedAt: null,
};

export function useVisitorStats(fallback?: VisitorStats) {
  const [stats, setStats] = useState<VisitorStats>(fallback ?? DEFAULT);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const ref = doc(db, "stats", "visitors");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setStats(snap.data() as VisitorStats);
          setLive(true);
        } else if (fallback) {
          setStats(fallback);
        }
      },
      () => {
        if (fallback) setStats(fallback);
      }
    );
    return unsub;
  }, [fallback]);

  return { stats, live };
}
