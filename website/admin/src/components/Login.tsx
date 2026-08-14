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
    } catch (err: any) {
      setMessage(err.message);
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
    } catch (err: any) {
      setMessage(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <img src="/assets/welcome-animation.svg" alt="Welcome" className="w-48 h-auto mb-8" />
      <div className="bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-md border border-slate-700 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src="/assets/logo.svg" alt="Logo" className="w-8 h-8" />
          <h2 className="text-2xl font-bold text-center">Admin Login</h2>
        </div>
        
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-white text-slate-900 py-3 rounded-lg font-semibold hover:bg-slate-200 transition-colors mb-6"
        >
          <LogIn size={20} />
          Sign in with Google
        </button>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-600"></div>
          <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">or sign in with email link</span>
          <div className="flex-grow border-t border-slate-600"></div>
        </div>

        <form onSubmit={handleEmailLinkSignIn} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="admin@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            <Mail size={18} />
            Send Magic Link
          </button>
        </form>

        {message && (
          <div className="mt-4 p-3 bg-slate-700 rounded-lg text-sm text-center">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
