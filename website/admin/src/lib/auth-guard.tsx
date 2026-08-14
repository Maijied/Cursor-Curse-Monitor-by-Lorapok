import { useEffect, useState, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

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
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthorized) {
    return (
      <div className="text-center p-12 bg-slate-800 rounded-xl border border-red-900 mt-12">
        <h2 className="text-2xl font-bold text-red-500 mb-4">Access Denied</h2>
        <p className="text-slate-300 mb-6">Your email address ({user.email}) is not authorized to access this dashboard.</p>
        <button 
          onClick={() => auth.signOut()}
          className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
