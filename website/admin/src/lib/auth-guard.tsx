import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";

export const MASTER_ADMIN = "mdshuvo40@gmail.com";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && u.email) {
        if (u.email === MASTER_ADMIN) {
          setIsAuthorized(true);
        } else {
          try {
            const q = query(collection(db, "admins"), where("email", "==", u.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setIsAuthorized(true);
            } else {
              setIsAuthorized(false);
            }
          } catch (e) {
            console.error("Error checking admin status:", e);
            setIsAuthorized(false);
          }
        }
      } else {
        setIsAuthorized(false);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)]" />
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

  return <>{children}</>;
}
