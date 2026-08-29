import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { UserPlus, Shield, Trash2 } from "lucide-react";
import { syncAdminAccess } from "../lib/api";
import { isMasterAdmin, MASTER_ADMIN } from "../lib/admin-config";
import PageHeader from "./layout/PageHeader";
import Card from "./ui/Card";

type AdminRecord = { id: string; email: string };

export default function Team() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const isMaster = isMasterAdmin(auth.currentUser?.email);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const snap = await getDocs(collection(db, "admins"));
      setAdmins(
        snap.docs.map((d) => ({
          id: d.id,
          email: String(d.data().email ?? ""),
        }))
      );
    } catch (e) {
      console.error("Failed to fetch admins", e);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const normalized = email.trim().toLowerCase();
      await addDoc(collection(db, "admins"), {
        email: normalized,
        role: "admin",
        createdAt: new Date(),
      });
      if (isMaster) {
        try {
          await syncAdminAccess({ email: normalized, action: "add" });
        } catch (syncErr) {
          console.warn("API admin sync failed (Firestore invite still saved):", syncErr);
          setMsg(
            `Admin added to Firestore. API sync pending — set ADMIN_EMAILS or ADMIN_KV in Cloudflare if they get 403 on API calls.`
          );
          setEmail("");
          fetchAdmins();
          setLoading(false);
          return;
        }
      }
      setMsg("Admin added successfully. They can now log in and use API endpoints.");
      setEmail("");
      fetchAdmins();
    } catch (err: unknown) {
      setMsg("Error: " + (err instanceof Error ? err.message : "Failed to add admin"));
    }
    setLoading(false);
  };

  const handleRemove = async (record: AdminRecord) => {
    if (!isMaster) return;
    if (!window.confirm(`Remove ${record.email} from admin access?`)) return;
    setLoading(true);
    setMsg("");
    try {
      await deleteDoc(doc(db, "admins", record.id));
      try {
        await syncAdminAccess({ email: record.email, action: "remove" });
      } catch (syncErr) {
        console.warn("API admin sync failed:", syncErr);
      }
      setMsg(`${record.email} removed.`);
      fetchAdmins();
    } catch (err: unknown) {
      setMsg("Error: " + (err instanceof Error ? err.message : "Failed to remove admin"));
    }
    setLoading(false);
  };

  const inputClass =
    "flex-1 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none transition-all text-[var(--color-text)]";

  return (
    <div className="space-y-6 animate-fade-slide-up">
      <PageHeader
        title="Team Access"
        description="Manage who has access to the deployment dashboard and authenticated API routes."
      />

      <Card>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-[var(--color-text)]">
          <UserPlus className="text-[var(--color-accent)]" size={20} aria-hidden="true" />
          Invite Administrator
        </h3>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Adds the email to Firestore and syncs API access (Cloudflare KV when configured).
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
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-[var(--color-text)]">
          <Shield className="text-[var(--color-neon)]" size={20} aria-hidden="true" />
          Authorized Administrators
        </h3>

        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl">
            <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--color-neon)_20%,transparent)] flex items-center justify-center text-[var(--color-neon)] font-bold border border-[color-mix(in_srgb,var(--color-neon)_30%,transparent)]">
              {MASTER_ADMIN[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[var(--color-text)]">{MASTER_ADMIN}</p>
              <p className="text-xs text-[var(--color-neon)] font-medium">Master Admin</p>
            </div>
          </div>

          {admins.map((record) => (
            <div
              key={record.id}
              className="flex items-center gap-4 p-4 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl"
            >
              <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] flex items-center justify-center text-[var(--color-accent)] font-bold border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]">
                {record.email[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--color-text)] truncate">{record.email}</p>
                <p className="text-xs text-[var(--color-accent-2)] font-medium">Admin</p>
              </div>
              {isMaster && (
                <button
                  type="button"
                  onClick={() => handleRemove(record)}
                  disabled={loading}
                  className="p-2 rounded-lg text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] transition-colors"
                  aria-label={`Remove ${record.email}`}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
