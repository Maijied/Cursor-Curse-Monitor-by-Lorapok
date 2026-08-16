import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { auth } from "../../lib/firebase";
import Sidebar from "./Sidebar";
import OnlineStatus from "../ui/OnlineStatus";
import Overview from "../pages/Overview";
import MarketplaceHealth from "../pages/MarketplaceHealth";
import Releases from "../pages/Releases";
import Activity from "../pages/Activity";
import ApiActivity from "../pages/ApiActivity";
import Reports from "../pages/Reports";
import Discussions from "../pages/Discussions";
import Deployments from "../pages/Deployments";
import Notices from "../pages/Notices";
import Docs from "../pages/Docs";
import SeoDashboard from "../pages/SeoDashboard";
import Settings from "../pages/Settings";
import Team from "../Team";

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) navigate("/login");
    });
    return unsub;
  }, [navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (!auth.currentUser) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden text-[var(--color-text)]">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 relative min-w-0 min-h-0 flex flex-col">
        <header className="md:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] shrink-0 z-30">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-white/5"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sm bg-gradient-to-r from-[var(--color-accent-2)] to-[var(--color-accent)] bg-clip-text text-transparent">
            Mission Control
          </span>
          <OnlineStatus compact />
        </header>

        <div className="flex-1 relative min-w-0 min-h-0">
          <div className="app-shell-bg" aria-hidden="true" />
          <main className="app-scroll-pane">
            <div className="p-6 md:p-8 max-w-6xl mx-auto">
              <Routes>
                <Route index element={<Overview />} />
                <Route path="marketplace" element={<MarketplaceHealth />} />
                <Route path="releases" element={<Releases />} />
                <Route path="activity" element={<Activity />} />
                <Route path="api-activity" element={<ApiActivity />} />
                <Route path="reports" element={<Reports />} />
                <Route path="discussions" element={<Discussions />} />
                <Route path="deployments" element={<Deployments />} />
                <Route path="deploy" element={<Navigate to="../deployments" replace />} />
                <Route path="notices" element={<Notices />} />
                <Route path="docs" element={<Docs />} />
                <Route path="seo" element={<SeoDashboard />} />
                <Route path="settings" element={<Settings />} />
                <Route path="team" element={<Team />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
