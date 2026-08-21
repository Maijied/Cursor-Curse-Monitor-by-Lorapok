import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  signInWithPopup,
  signInWithEmailLink,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { useNavigate, Link } from "react-router-dom";
import { ExternalLink, LogIn, Mail } from "lucide-react";
import {
  configureAuthPersistence,
  getRememberMePreference,
} from "../lib/auth-session";
import BackToWebsiteButton from "./ui/BackToWebsiteButton";
import { MARKETING_SITE_URL } from "../lib/marketing-site";

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem("emailForSignIn") ?? "");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [rememberMe, setRememberMe] = useState(getRememberMePreference);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const stored = window.localStorage.getItem("emailForSignIn");
    if (stored) {
      setConfirmEmail(stored);
      setNeedsEmailConfirm(true);
      return;
    }
    setNeedsEmailConfirm(true);
  }, []);

  const completeEmailLinkSignIn = async (emailForSignIn: string) => {
    setLoading(true);
    setMessageTone("info");
    try {
      await configureAuthPersistence(auth, rememberMe);
      await signInWithEmailLink(auth, emailForSignIn, window.location.href);
      window.localStorage.removeItem("emailForSignIn");
      navigate("/dashboard");
    } catch (err: unknown) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Error signing in with link");
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessageTone("info");
    try {
      await configureAuthPersistence(auth, rememberMe);
      await signInWithPopup(auth, googleProvider);
      navigate("/dashboard");
    } catch (err: unknown) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Sign-in failed");
    }
    setLoading(false);
  };

  const handleEmailLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessageTone("info");
    const actionCodeSettings = {
      url: `${window.location.origin}/login`,
      handleCodeInApp: true,
    };
    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email);
      setMessage("Login link sent — check your inbox.");
    } catch (err: unknown) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to send link");
    }
    setLoading(false);
  };

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none text-[var(--color-text)]";

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col">
      <div className="app-shell-bg fixed inset-0" aria-hidden="true" />

      <header className="relative z-10 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-elevated)_85%,transparent)] backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/login" className="flex items-center gap-3 min-w-0">
            <img src="/assets/logo.svg" alt="" className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-base bg-gradient-to-r from-[var(--color-accent-2)] to-[var(--color-accent)] bg-clip-text text-transparent truncate">
                Cursor Curse Monitor
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Mission Control · Lorapok Labs</p>
            </div>
          </Link>
          <BackToWebsiteButton compact className="w-auto shrink-0" />
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center py-10 px-4">
        <motion.img
          src="/assets/welcome-animation.svg"
          alt=""
          className="w-40 h-auto mb-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        />

        <motion.div
          className="glass-panel p-8 w-full max-w-md relative overflow-hidden"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--color-accent-2)] via-[var(--color-accent)] to-[var(--color-neon)]" />
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Admin sign in</h1>
            <p className="text-sm text-[var(--color-muted)] mt-1">Authorized Lorapok administrators only</p>
          </div>

          {needsEmailConfirm ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void completeEmailLinkSignIn(confirmEmail.trim());
              }}
              className="space-y-4"
            >
              <p className="text-sm text-[var(--color-muted)] text-center">
                Confirm your email to finish signing in with the magic link.
              </p>
              <div>
                <label htmlFor="confirm-email" className="block text-sm font-medium mb-1 text-[var(--color-muted)]">
                  Email address
                </label>
                <input
                  id="confirm-email"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="admin@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !confirmEmail.trim()}
                className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-colors disabled:opacity-50"
              >
                <LogIn size={18} aria-hidden="true" />
                Complete sign in
              </button>
            </form>
          ) : (
            <>
              <label className="flex items-center gap-2 mb-4 text-sm text-[var(--color-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[var(--color-border)]"
                />
                Keep me signed in on this device
              </label>

              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-white text-[var(--color-bg-base)] py-3 rounded-xl font-semibold hover:bg-slate-200 transition-colors mb-6 disabled:opacity-50"
              >
                <LogIn size={20} aria-hidden="true" />
                Sign in with Google
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[var(--color-border)]" />
                <span className="flex-shrink-0 mx-4 text-[var(--color-muted)] text-sm">or sign in with email link</span>
                <div className="flex-grow border-t border-[var(--color-border)]" />
              </div>

              <form onSubmit={handleEmailLinkSignIn} className="mt-4 flex flex-col gap-4">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium mb-1 text-[var(--color-muted)]">
                    Email address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="admin@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  <Mail size={18} aria-hidden="true" />
                  Send magic link
                </button>
              </form>
            </>
          )}

          {message && (
            <div
              className={`mt-4 p-3 rounded-xl text-sm text-center border ${
                messageTone === "error"
                  ? "bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] text-[var(--color-danger)]"
                  : "bg-[var(--color-bg-base)] border-[var(--color-border)] text-[var(--color-muted)]"
              }`}
            >
              {message}
            </div>
          )}
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-[var(--color-border)] py-6 px-4 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--color-muted)]">
          <p>© {new Date().getFullYear()} Lorapok Labs · Cursor Curse Monitor</p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-[var(--color-accent-2)] transition-colors"
            >
              <ExternalLink size={16} aria-hidden="true" />
              GitHub
            </a>
            <a href={MARKETING_SITE_URL} className="hover:text-[var(--color-accent-2)] transition-colors">
              Marketing site
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
