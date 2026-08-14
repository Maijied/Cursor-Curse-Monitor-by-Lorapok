import { useState, useEffect } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserPlus, Shield } from "lucide-react";
import PageHeader from "./layout/PageHeader";
import Card from "./ui/Card";

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

  const inputClass =
    "flex-1 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none transition-all text-[var(--color-text)]";

  return (
    <div className="max-w-3xl animate-fade-slide-up">
      <PageHeader
        title="Team Access"
        description="Manage who has access to the deployment dashboard."
      />

      <Card className="mb-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-3 text-[var(--color-text)]">
          <UserPlus className="text-[var(--color-accent)]" size={24} />
          Invite Administrator
        </h3>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Add an email to the admin list. They will instantly gain access to the dashboard.
        </p>

        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="colleague@example.com"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--color-accent)] hover:opacity-90 text-white font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-50 shadow-[0_8px_24px_rgba(124,92,255,0.25)]"
          >
            {loading ? "Adding…" : "Add Admin"}
          </button>
        </form>

        {msg && <p className="mt-4 text-sm text-[var(--color-accent-2)] font-medium">{msg}</p>}
      </Card>

      <Card>
        <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-[var(--color-text)]">
          <Shield className="text-[var(--color-neon)]" size={24} />
          Authorized Administrators
        </h3>

        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl">
            <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--color-neon)_20%,transparent)] flex items-center justify-center text-[var(--color-neon)] font-bold border border-[color-mix(in_srgb,var(--color-neon)_30%,transparent)]">
              M
            </div>
            <div>
              <p className="font-semibold text-[var(--color-text)]">mdshuvo40@gmail.com</p>
              <p className="text-xs text-[var(--color-neon)] font-medium">Master Admin</p>
            </div>
          </div>

          {admins.map((adminEmail, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl">
              <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] flex items-center justify-center text-[var(--color-accent)] font-bold border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]">
                {adminEmail[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-[var(--color-text)]">{adminEmail}</p>
                <p className="text-xs text-[var(--color-accent-2)] font-medium">Admin</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
