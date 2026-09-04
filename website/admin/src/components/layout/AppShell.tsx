import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { auth } from "../../lib/firebase";
import Sidebar from "./Sidebar";
import PermissionRoute from "./PermissionRoute";
import { APP_ROUTES } from "../../routes";
import { DeployRuntimeProvider } from "../../context/DeployRuntimeContext";
import OnlineStatus from "../ui/OnlineStatus";
import SyncStatusChip from "../ui/SyncStatusChip";
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

const ROUTE_PERMISSION_BY_SEGMENT: Record<string, (typeof APP_ROUTES)[number]["permission"]> =
  Object.fromEntries(
    APP_ROUTES
      .filter((r) => r.path !== "/dashboard")
      .map((r) => [r.path.replace(/^\/dashboard\/?/, "") || "", r.permission])
  );

function GuardedRoute({
  segment,
  children,
}: {
  segment: string;
  children: ReactNode;
}) {
  return (
    <PermissionRoute permission={ROUTE_PERMISSION_BY_SEGMENT[segment]}>
      {children}
    </PermissionRoute>
  );
}

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
    <div className="flex h-screen h-dvh min-h-0 w-full overflow-hidden text-[var(--color-text)]">
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
          <div className="flex items-center gap-2">
            <SyncStatusChip compact />
            <OnlineStatus compact />
            <ActiveUsersLive compact />
          </div>
        </header>

        <div className="flex-1 relative min-w-0 min-h-0">
          <div className="app-shell-bg" aria-hidden="true" />
          <main className="app-scroll-pane">
            <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full min-w-0">
              <Suspense fallback={<LarvaeLoaderPanel label="Loading page…" className="min-h-64 border-0 bg-transparent" />}>
                <Routes>
                  <Route index element={<Overview />} />
                  <Route path="marketplace" element={<GuardedRoute segment="marketplace"><MarketplaceHealth /></GuardedRoute>} />
                  <Route path="releases" element={<GuardedRoute segment="releases"><Releases /></GuardedRoute>} />
                  <Route path="activity" element={<GuardedRoute segment="activity"><Activity /></GuardedRoute>} />
                  <Route path="logs" element={<GuardedRoute segment="logs"><Logs /></GuardedRoute>} />
                  <Route path="mailbox" element={<GuardedRoute segment="mailbox"><Mailbox /></GuardedRoute>} />
                  <Route path="subscribers" element={<GuardedRoute segment="subscribers"><Subscribers /></GuardedRoute>} />
                  <Route path="api-explorer" element={<GuardedRoute segment="api-explorer"><ApiExplorer /></GuardedRoute>} />
                  <Route path="reports" element={<GuardedRoute segment="reports"><Reports /></GuardedRoute>} />
                  <Route path="discussions" element={<GuardedRoute segment="discussions"><Discussions /></GuardedRoute>} />
                  <Route path="architecture" element={<GuardedRoute segment="architecture"><Architecture /></GuardedRoute>} />
                  <Route path="deployments" element={<GuardedRoute segment="deployments"><Deployments /></GuardedRoute>} />
                  <Route path="notices" element={<GuardedRoute segment="notices"><Notices /></GuardedRoute>} />
                  <Route path="docs" element={<GuardedRoute segment="docs"><Docs /></GuardedRoute>} />
                  <Route path="seo" element={<GuardedRoute segment="seo"><SeoDashboard /></GuardedRoute>} />
                  <Route path="settings" element={<GuardedRoute segment="settings"><Settings /></GuardedRoute>} />
                  <Route path="team" element={<GuardedRoute segment="team"><Team /></GuardedRoute>} />
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
