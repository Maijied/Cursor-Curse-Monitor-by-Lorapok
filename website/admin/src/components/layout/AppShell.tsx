import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { auth } from "../../lib/firebase";
import Sidebar from "./Sidebar";
import Overview from "../pages/Overview";
import MarketplaceHealth from "../pages/MarketplaceHealth";
import Releases from "../pages/Releases";
import Activity from "../pages/Activity";
import Reports from "../pages/Reports";
import Discussions from "../pages/Discussions";
import Deployments from "../pages/Deployments";
import SeoDashboard from "../pages/SeoDashboard";
import Settings from "../pages/Settings";
import Team from "../Team";

export default function AppShell() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) navigate("/login");
    });
    return unsub;
  }, [navigate]);

  if (!auth.currentUser) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden text-[var(--color-text)]">
      <Sidebar />
      <div className="flex-1 relative min-w-0 min-h-0">
        <div className="app-shell-bg" aria-hidden="true" />
        <main className="app-scroll-pane">
          <div className="p-6 md:p-8 max-w-6xl mx-auto">
            <Routes>
            <Route index element={<Overview />} />
            <Route path="marketplace" element={<MarketplaceHealth />} />
            <Route path="releases" element={<Releases />} />
            <Route path="activity" element={<Activity />} />
            <Route path="reports" element={<Reports />} />
            <Route path="discussions" element={<Discussions />} />
            <Route path="deployments" element={<Deployments />} />
            <Route path="deploy" element={<Navigate to="../deployments" replace />} />
            <Route path="seo" element={<SeoDashboard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="team" element={<Team />} />
          </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
