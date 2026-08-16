import { useState, useEffect } from "react";
import { signInWithPopup, signInWithEmailLink, isSignInWithEmailLink, sendSignInLinkToEmail } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { LogIn, Mail } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let emailForSignIn = window.localStorage.getItem("emailForSignIn");
      if (!emailForSignIn) {
        emailForSignIn = window.prompt("Please provide your email for confirmation");
      }
      if (emailForSignIn) {
        signInWithEmailLink(auth, emailForSignIn, window.location.href)
          .then(() => {
            window.localStorage.removeItem("emailForSignIn");
            navigate("/dashboard");
          })
          .catch((err) => setMessage("Error signing in with link: " + err.message));
      }
    }
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/dashboard");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Sign-in failed");
    }
    setLoading(false);
  };

  const handleEmailLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const actionCodeSettings = {
      url: window.location.origin + "/login",
      handleCodeInApp: true,
    };
    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email);
      setMessage("Login link sent to your email!");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to send link");
    }
    setLoading(false);
  };

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none text-[var(--color-text)]";

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="app-shell-bg fixed inset-0" aria-hidden="true" />
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center py-12 px-4">
      <header className="mb-6 text-center animate-fade-slide-up">
        <h1 className="brand-title text-3xl sm:text-4xl font-bold tracking-tight">
          Cursor Curse Monitor
        </h1>
        <div className="mt-3 flex items-center justify-center gap-3">
          <span className="brand-rule h-px w-10 sm:w-14 bg-gradient-to-r from-transparent to-[var(--color-accent)]" aria-hidden="true" />
          <span className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.3em] text-[var(--color-muted)]">
            Login Panel
          </span>
          <span className="brand-rule h-px w-10 sm:w-14 bg-gradient-to-l from-transparent to-[var(--color-accent)]" aria-hidden="true" />
        </div>
      </header>
      <img src="/assets/welcome-animation.svg" alt="Welcome" className="w-48 h-auto mb-8 animate-fade-slide-up stagger-1" />
      <div className="glass-panel p-8 w-full max-w-md relative overflow-hidden animate-fade-slide-up stagger-2">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--color-accent-2)] via-[var(--color-accent)] to-[var(--color-neon)]" />
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src="/assets/logo.svg" alt="Logo" className="w-8 h-8" />
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Admin Login</h2>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-white text-[var(--color-bg-base)] py-3 rounded-xl font-semibold hover:bg-slate-200 transition-colors mb-6"
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
              Email Address
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
            className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-colors"
          >
            <Mail size={18} aria-hidden="true" />
            Send Magic Link
          </button>
        </form>

        {message && (
          <div className="mt-4 p-3 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl text-sm text-center text-[var(--color-muted)]">
            {message}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
