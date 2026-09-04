import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { LarvaeLoaderPanel } from "../components/ui/LorapokLarvaeLoader";
import PinUnlockOverlay from "../components/ui/PinUnlockOverlay";
import {
  clearPinUnlockSession,
  isPinUnlockSession,
  pinEnabledForEmail,
} from "./pin-unlock";
import { AuthProvider } from "./auth-context";
import { fetchAuthMe } from "./api";
import { MASTER_ADMIN } from "./admin-config";

export { MASTER_ADMIN };

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinUnlocked, setPinUnlocked] = useState(() => isPinUnlockSession());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u?.email) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      try {
        await fetchAuthMe();
        setIsAuthorized(true);
      } catch (e) {
        console.error("Admin authorization check failed:", e);
        setIsAuthorized(false);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center p-8">
        <LarvaeLoaderPanel label="Verifying access…" className="min-h-0 border-0 bg-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center p-8">
        <div className="glass-panel text-center p-12 max-w-lg border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)]">
          <h2 className="text-2xl font-bold text-[var(--color-danger)] mb-4">Access Denied</h2>
          <p className="text-[var(--color-muted)] mb-6">
            Your email address ({user.email}) is not authorized to access this dashboard.
          </p>
          <button
            type="button"
            onClick={() => auth.signOut()}
            className="px-6 py-2 bg-[var(--color-bg-base)] hover:bg-white/5 rounded-xl text-[var(--color-text)] transition-colors border border-[var(--color-border)]"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const needsPin = pinEnabledForEmail(user.email) && !pinUnlocked;

  return (
    <AuthProvider user={user}>
      {needsPin ? (
        <PinUnlockOverlay
          email={user.email ?? ""}
          onUnlocked={() => setPinUnlocked(true)}
          onUseFullSignIn={() => {
            clearPinUnlockSession();
            void signOut(auth);
          }}
        />
      ) : null}
      {children}
    </AuthProvider>
  );
}
