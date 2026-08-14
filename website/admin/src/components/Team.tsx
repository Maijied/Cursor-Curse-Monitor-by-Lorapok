import { useState, useEffect } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Users, UserPlus, Shield } from "lucide-react";

export default function Team() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [admins, setAdmins] = useState<string[]>([]);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const snap = await getDocs(collection(db, "admins"));
      const adminList = snap.docs.map(doc => doc.data().email);
      setAdmins(adminList);
    } catch (e) {
      console.error("Failed to fetch admins", e);
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      await addDoc(collection(db, "admins"), {
        email,
        role: "admin",
        createdAt: new Date()
      });
      setMsg("Admin added successfully. They can now log in.");
      setEmail("");
      fetchAdmins();
    } catch (err: any) {
      setMsg("Error: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
      <h2 className="text-3xl font-bold text-white mb-2">Team Access</h2>
      <p className="text-slate-400 mb-8">Manage who has access to the deployment dashboard.</p>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-xl mb-8">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-3 text-white">
          <UserPlus className="text-indigo-400" size={24} />
          Invite Administrator
        </h3>
        <p className="text-sm text-slate-400 mb-6">
          Add an email to the admin list. They will instantly gain access to the dashboard.
        </p>

        <form onSubmit={handleInvite} className="flex gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="colleague@example.com"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Admin"}
          </button>
        </form>

        {msg && <p className="mt-4 text-sm text-indigo-300 font-medium">{msg}</p>}
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-xl">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
          <Shield className="text-emerald-400" size={24} />
          Authorized Administrators
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-800 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/30">M</div>
            <div>
              <p className="font-semibold text-slate-200">mdshuvo40@gmail.com</p>
              <p className="text-xs text-emerald-500 font-medium">Master Admin</p>
            </div>
          </div>
          
          {admins.map((adminEmail, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-800 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/30">
                {adminEmail[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-200">{adminEmail}</p>
                <p className="text-xs text-indigo-400 font-medium">Admin</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
