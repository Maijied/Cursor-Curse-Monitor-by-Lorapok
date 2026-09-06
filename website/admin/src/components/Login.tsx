import { useState, useEffect, useCallback } from "react";
import {
  signInWithPopup,
  signInWithEmailLink,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ExternalLink, KeyRound, LogIn, Mail, Sparkles } from "lucide-react";
import LorapokLarvaeLoader, { LarvaeLoaderPanel } from "./ui/LorapokLarvaeLoader";
import {
  configureAuthPersistence,
  getRememberMePreference,
} from "../lib/auth-session";
import BackToWebsiteButton from "./ui/BackToWebsiteButton";
import { MARKETING_SITE_URL } from "../lib/marketing-site";
import { fetchAuthInviteCheck } from "../lib/api";
import { passwordStrengthColor, validatePassword } from "../lib/password-policy";
import LoginInfraPanel from "./LoginInfraPanel";

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem("emailForSignIn") ?? "");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [rememberMe, setRememberMe] = useState(getRememberMePreference);
  const [authMode, setAuthMode] = useState<"magic" | "password">("magic");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [setupPassword, setSetupPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const navigate = useNavigate();

  const completeEmailLinkSignIn = useCallback(async (emailForSignIn: string) => {
    setLoading(true);
    setMessageTone("info");
    setMessage("Verifying magic link…");
    try {
      await configureAuthPersistence(auth, rememberMe);
      await signInWithEmailLink(auth, emailForSignIn, window.location.href);
      window.localStorage.removeItem("emailForSignIn");
      setMessageTone("success");
      setMessage("Authentication successful! Redirecting…");
      setTimeout(() => navigate("/dashboard", { replace: true }), 400);
    } catch (err: unknown) {
      setMessageTone("error");
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr?.code === "auth/invalid-action-code") {
        setMessage("This sign-in link has expired or has already been used. Please request a new one.");
      } else {
        setMessage(firebaseErr?.message || "Error signing in with magic link.");
      }
      setNeedsEmailConfirm(true);
    } finally {
      setLoading(false);
    }
  }, [navigate, rememberMe]);

  // If already logged in, automatically redirect to dashboard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthChecking(false);
      if (u && !isSignInWithEmailLink(auth, window.location.href)) {
        navigate("/dashboard", { replace: true });
      }
    });
    return unsub;
  }, [navigate]);

  // Handle incoming email magic links
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const stored = window.localStorage.getItem("emailForSignIn");
    if (stored) {
      setConfirmEmail(stored);
      void completeEmailLinkSignIn(stored);
      return;
    }
    setNeedsEmailConfirm(true);
  }, [completeEmailLinkSignIn]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessageTone("info");
    setMessage("");
    try {
      await configureAuthPersistence(auth, rememberMe);
      const result = await signInWithPopup(auth, googleProvider);
      const address = result.user.email?.trim().toLowerCase() ?? "";
      if (!address) {
        setMessageTone("error");
        setMessage("Google account has no email address.");
        await auth.signOut();
        return;
      }
      if (!(await ensureInvited(address))) {
        await auth.signOut();
        return;
      }
      setMessageTone("success");
      setMessage("Authenticated! Redirecting to Mission Control…");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setMessageTone("error");
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr?.code === "auth/popup-blocked" || firebaseErr?.code === "auth/popup-closed-by-user") {
        setMessage("Popup was closed or blocked by your browser. Please allow popups or use the Email Magic Link below.");
      } else if (firebaseErr?.code === "auth/unauthorized-domain") {
        setMessage("Domain not authorized in Firebase Console. Please add this domain to Firebase Auth Authorized Domains.");
      } else {
        setMessage(firebaseErr?.message || "Google sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMessageTone("info");
    setMessage("");
    const actionCodeSettings = {
      url: `${window.location.origin}/login`,
      handleCodeInApp: true,
    };
    try {
      const invite = await fetchAuthInviteCheck(email.trim());
      if (!invite.invited) {
        setMessageTone("error");
        setMessage("This email is not on the Mission Control invite list. Contact the master admin.");
        setLoading(false);
        return;
      }
      await configureAuthPersistence(auth, rememberMe);
      await sendSignInLinkToEmail(auth, email.trim(), actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email.trim());
      setMessageTone("success");
      setMessage(`Magic login link sent to ${email.trim()}. Please check your inbox and spam folder.`);
    } catch (err: unknown) {
      setMessageTone("error");
      const firebaseErr = err as { code?: string; message?: string };
      setMessage(firebaseErr?.message || "Failed to send magic link. Please check the email address.");
    } finally {
      setLoading(false);
    }
  };

  const ensureInvited = async (address: string) => {
    const invite = await fetchAuthInviteCheck(address);
    if (!invite.invited) {
      setMessageTone("error");
      setMessage("This email is not on the Mission Control invite list. Contact the master admin.");
      return false;
    }
    return true;
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address || !password) return;

    setLoading(true);
    setMessageTone("info");
    setMessage("");
    try {
      if (!(await ensureInvited(address))) return;
      await configureAuthPersistence(auth, rememberMe);
      await signInWithEmailAndPassword(auth, address, password);
      setMessageTone("success");
      setMessage("Authenticated! Redirecting to Mission Control…");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr?.code === "auth/user-not-found" || firebaseErr?.code === "auth/invalid-credential") {
        setSetupPassword(true);
        setMessageTone("info");
        setMessage("No password is set for this invite yet. Create one below (min 12 characters).");
      } else if (firebaseErr?.code === "auth/operation-not-allowed") {
        setMessageTone("error");
        setMessage("Email/password sign-in is not enabled in Firebase Console (Authentication → Sign-in method → Email/Password).");
      } else if (firebaseErr?.code === "auth/too-many-requests") {
        setMessageTone("error");
        setMessage("Too many attempts. Wait a few minutes or use Google / magic link.");
      } else {
        setMessageTone("error");
        setMessage(firebaseErr?.message || "Password sign-in failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    const check = validatePassword(password);
    if (!check.ok) {
      setMessageTone("error");
      setMessage(check.errors.join(" · "));
      return;
    }
    if (password !== passwordConfirm) {
      setMessageTone("error");
      setMessage("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    setMessageTone("info");
    setMessage("");
    try {
      if (!(await ensureInvited(address))) return;
      await configureAuthPersistence(auth, rememberMe);
      await createUserWithEmailAndPassword(auth, address, password);
      setMessageTone("success");
      setMessage("Password created. Redirecting to Mission Control…");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr?.code === "auth/email-already-in-use") {
        setSetupPassword(false);
        setMessageTone("error");
        setMessage("Account already exists — use Sign in with password instead.");
      } else if (firebaseErr?.code === "auth/operation-not-allowed") {
        setMessageTone("error");
        setMessage("Email/password sign-in is not enabled in Firebase Console.");
      } else {
        setMessageTone("error");
        setMessage(firebaseErr?.message || "Could not create password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const address = email.trim();
    if (!address) {
      setMessageTone("error");
      setMessage("Enter your admin email first.");
      return;
    }
    setLoading(true);
    setMessageTone("info");
    setMessage("");
    try {
      if (!(await ensureInvited(address))) return;
      await sendPasswordResetEmail(auth, address, { url: `${window.location.origin}/login` });
      setMessageTone("success");
      setMessage(`Password reset email sent to ${address}.`);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      setMessageTone("error");
      setMessage(firebaseErr?.message || "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  };

  const passwordCheck = validatePassword(password);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none text-[var(--color-text)] transition-shadow";

  if (authChecking) {
    return (
      <div className="min-h-screen app-shell-bg flex items-center justify-center p-8">
        <LarvaeLoaderPanel label="Checking session…" className="min-h-0 border-0 bg-transparent" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col justify-between">
      <div className="app-shell-bg fixed inset-0" aria-hidden="true" />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center py-10 px-4">
        {/* Animated Welcome Illustration & Glowing Title */}
        <div className="flex flex-col items-center mb-6 animate-fade-slide-up text-center">
          <img
            src="/assets/welcome-animation.svg"
            alt="Welcome to Mission Control"
            className="w-44 h-auto mb-4"
          />
          <div className="flex items-center justify-center gap-3">
            <div className="relative shrink-0">
              <img
                src="/assets/logo.svg"
                alt="Logo"
                className="w-9 h-9 drop-shadow-[0_0_12px_rgba(124,92,255,0.4)]"
              />
            </div>
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[var(--color-accent-2)] via-[var(--color-accent)] to-[var(--color-neon)] bg-clip-text text-transparent leading-tight">
                Cursor Curse Admin Panel
              </h1>
              <p className="text-[11px] uppercase tracking-wider text-[var(--color-muted)] font-medium">
                Mission Control · Lorapok Labs
              </p>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="glass-panel p-6 sm:p-8 w-full max-w-md relative overflow-hidden animate-fade-slide-up shadow-2xl border border-[var(--color-border)]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--color-accent-2)] via-[var(--color-accent)] to-[var(--color-neon)]" />

          {needsEmailConfirm ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void completeEmailLinkSignIn(confirmEmail.trim());
              }}
              className="space-y-4"
            >
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">
                <p className="font-semibold mb-1 flex items-center gap-1.5">
                  <Sparkles size={14} /> Magic Link Verification
                </p>
                Confirm your email address to complete your sign-in to Mission Control.
              </div>
              <div>
                <label htmlFor="confirm-email" className="block text-xs font-medium mb-1 text-[var(--color-muted)]">
                  Email address
                </label>
                <input
                  id="confirm-email"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="admin@lorapok.tech"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !confirmEmail.trim()}
                className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 shadow-md"
              >
                {loading ? <LorapokLarvaeLoader size="sm" ariaLabel="Signing in" /> : <LogIn size={18} aria-hidden="true" />}
                {loading ? "Signing in…" : "Complete Sign In"}
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 bg-white text-[#0f172a] py-3 rounded-xl font-semibold hover:bg-slate-100 transition-all mb-4 disabled:opacity-50 shadow-sm text-sm"
              >
                {loading ? (
                  <LorapokLarvaeLoader size="sm" ariaLabel="Authenticating" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                {loading ? "Authenticating…" : "Sign in with Google"}
              </button>

              <label className="flex items-center gap-2 mb-4 text-xs text-[var(--color-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                />
                Keep me signed in on this device
              </label>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[var(--color-border)]" />
                <span className="flex-shrink-0 mx-3 text-[var(--color-muted)] text-[11px] uppercase tracking-wider">
                  or email
                </span>
                <div className="flex-grow border-t border-[var(--color-border)]" />
              </div>

              <div className="mt-3 flex rounded-xl border border-[var(--color-border)] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("magic");
                    setSetupPassword(false);
                  }}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    authMode === "magic"
                      ? "bg-[var(--color-accent)] text-white"
                      : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  Magic link
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("password")}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    authMode === "password"
                      ? "bg-[var(--color-accent)] text-white"
                      : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  Password
                </button>
              </div>

              {authMode === "magic" ? (
              <form onSubmit={handleEmailLinkSignIn} className="mt-3 flex flex-col gap-3">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium mb-1 text-[var(--color-muted)]">
                    Admin email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="admin@lorapok.tech"
                    autoComplete="email"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 shadow-md text-sm"
                >
                  {loading ? <LorapokLarvaeLoader size="sm" ariaLabel="Sending sign-in link" /> : <Mail size={16} aria-hidden="true" />}
                  {loading ? "Sending link…" : "Send Magic Sign-In Link"}
                </button>
              </form>
              ) : (
              <form
                onSubmit={(e) => void (setupPassword ? handlePasswordSetup(e) : handlePasswordSignIn(e))}
                className="mt-3 flex flex-col gap-3"
              >
                <div>
                  <label htmlFor="login-email-pw" className="block text-xs font-medium mb-1 text-[var(--color-muted)]">
                    Admin email
                  </label>
                  <input
                    id="login-email-pw"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="admin@lorapok.tech"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="block text-xs font-medium mb-1 text-[var(--color-muted)]">
                    {setupPassword ? "New password" : "Password"}
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={inputClass}
                    autoComplete={setupPassword ? "new-password" : "current-password"}
                    minLength={12}
                  />
                  {password ? (
                    <p className="mt-1 text-[11px]" style={{ color: passwordStrengthColor(passwordCheck.score) }}>
                      Strength: {passwordCheck.label}
                      {passwordCheck.errors.length ? ` — ${passwordCheck.errors.join(", ")}` : ""}
                    </p>
                  ) : null}
                </div>
                {setupPassword ? (
                  <div>
                    <label htmlFor="login-password-confirm" className="block text-xs font-medium mb-1 text-[var(--color-muted)]">
                      Confirm password
                    </label>
                    <input
                      id="login-password-confirm"
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      required
                      className={inputClass}
                      autoComplete="new-password"
                      minLength={12}
                    />
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 shadow-md text-sm"
                >
                  {loading ? (
                    <LorapokLarvaeLoader size="sm" ariaLabel="Signing in" />
                  ) : (
                    <KeyRound size={16} aria-hidden="true" />
                  )}
                  {loading
                    ? setupPassword
                      ? "Creating password…"
                      : "Signing in…"
                    : setupPassword
                    ? "Create password & sign in"
                    : "Sign in with password"}
                </button>
                {!setupPassword ? (
                  <button
                    type="button"
                    onClick={() => void handlePasswordReset()}
                    disabled={loading}
                    className="text-xs text-[var(--color-muted)] hover:text-[var(--color-accent-2)] transition-colors"
                  >
                    Forgot password?
                  </button>
                ) : null}
              </form>
              )}
            </>
          )}

          {message && (
            <div
              className={`mt-4 p-3 rounded-xl text-xs text-center border flex items-center justify-center gap-2 ${
                messageTone === "error"
                  ? "bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] text-[var(--color-danger)]"
                  : messageTone === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-[var(--color-bg-base)] border-[var(--color-border)] text-[var(--color-muted)]"
              }`}
            >
              {messageTone === "success" && <CheckCircle2 size={14} className="shrink-0" />}
              <span>{message}</span>
            </div>
          )}
        </div>

        <LoginInfraPanel />

        {/* Back to Website Button Below Card */}
        <div className="mt-6 w-full max-w-md animate-fade-slide-up">
          <BackToWebsiteButton className="w-full" />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--color-border)] py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-muted)]">
          <p>© {new Date().getFullYear()} Lorapok Labs · Cursor Curse Monitor</p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-[var(--color-accent-2)] transition-colors"
            >
              <ExternalLink size={14} aria-hidden="true" />
              GitHub
            </a>
            <a href={MARKETING_SITE_URL} className="hover:text-[var(--color-accent-2)] transition-colors">
              Marketing Site
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
