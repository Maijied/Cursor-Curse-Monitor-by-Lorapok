import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { auth } from "../../lib/firebase";
import Sidebar from "./Sidebar";
import { DeployRuntimeProvider } from "../../context/DeployRuntimeContext";
import OnlineStatus from "../ui/OnlineStatus";
import ActiveUsersLive from "../ui/ActiveUsersLive";
import { LarvaeLoaderPanel } from "../ui/LorapokLarvaeLoader";
import Overview from "../pages/Overview";
const MarketplaceHealth = lazy(() => import("../pages/MarketplaceHealth"));
const Releases = lazy(() => import("../pages/Releases"));
const Activity = lazy(() => import("../pages/Activity"));
const ApiExplorer = lazy(() => import("../pages/ApiExplorer"));
const Logs = lazy(() => import("../pages/Logs"));
const Mailbox = lazy(() => import("../pages/Mailbox"));
const Subscribers = lazy(() => import("../pages/Subscribers"));
const Reports = lazy(() => import("../pages/Reports"));
const Discussions = lazy(() => import("../pages/Discussions"));
const Architecture = lazy(() => import("../pages/Architecture"));
const Deployments = lazy(() => import("../pages/Deployments"));
const Notices = lazy(() => import("../pages/Notices"));
const Docs = lazy(() => import("../pages/Docs"));
const SeoDashboard = lazy(() => import("../pages/SeoDashboard"));
const Settings = lazy(() => import("../pages/Settings"));
const Team = lazy(() => import("../Team"));
const NotFound = lazy(() => import("../pages/NotFound"));

/**
 * Renders the authenticated application shell and its routed pages.
 *
 * Redirects unauthenticated users to the login page and closes the mobile sidebar when the route changes.
 */
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
    <DeployRuntimeProvider>
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
            className="p-2.5 min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-[var(--color-border)] hover:bg-white/5"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sm bg-gradient-to-r from-[var(--color-accent-2)] to-[var(--color-accent)] bg-clip-text text-transparent">
            Mission Control
          </span>
          <OnlineStatus compact />
          <ActiveUsersLive compact />
        </header>

        <div className="flex-1 relative min-w-0 min-h-0">
          <div className="app-shell-bg" aria-hidden="true" />
          <main className="app-scroll-pane">
            <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full min-w-0">
              <Suspense fallback={<LarvaeLoaderPanel label="Loading page…" className="min-h-64 border-0 bg-transparent" />}>
                <Routes>
                  <Route index element={<Overview />} />
                  <Route path="marketplace" element={<MarketplaceHealth />} />
                  <Route path="releases" element={<Releases />} />
                  <Route path="activity" element={<Activity />} />
                  <Route path="logs" element={<Logs />} />
                  <Route path="mailbox" element={<Mailbox />} />
                  <Route path="subscribers" element={<Subscribers />} />
                  <Route path="api-explorer" element={<ApiExplorer />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="discussions" element={<Discussions />} />
                  <Route path="architecture" element={<Architecture />} />
                  <Route path="deployments" element={<Deployments />} />
                  <Route path="notices" element={<Notices />} />
                  <Route path="docs" element={<Docs />} />
                  <Route path="seo" element={<SeoDashboard />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="team" element={<Team />} />
                  <Route path="*" element={<NotFound inApp />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
    </DeployRuntimeProvider>
  );
}
