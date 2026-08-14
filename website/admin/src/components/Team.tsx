import { useState } from "react";

import { collection, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Team() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      // Create a pending invite in Firestore. 
      // The secure Cloudflare worker or a Firebase Function should ideally handle 
      // the actual sending of the email link, or we rely on Firestore rules to allow this.
      await addDoc(collection(db, "invites"), {
        email,
        role: "admin",
        createdAt: new Date()
      });
      setMsg("Invite recorded successfully. (Note: Email sending requires Cloud Function setup)");
      setEmail("");
    } catch (err: any) {
      setMsg("Error: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
        <img src="/assets/team-usage.svg" alt="Team" className="w-7 h-7" />
        Invite Admin
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Invited users will receive a magic link to sign in and gain deployment access.
      </p>

      <form onSubmit={handleInvite} className="flex gap-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="colleague@example.com"
          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send Invite"}
        </button>
      </form>

      {msg && <p className="mt-4 text-sm text-blue-300">{msg}</p>}
    </div>
  );
}
