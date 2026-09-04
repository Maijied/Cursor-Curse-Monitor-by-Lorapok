import { useState, useEffect, useCallback } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserPlus, Shield, Trash2 } from "lucide-react";
import { fetchRbacTeam, putRbacRole, syncAdminAccess } from "../lib/api";
import { useAuthSession } from "../lib/auth-context";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AdminRole } from "../lib/rbac";
import PageHeader from "./layout/PageHeader";
import Card from "./ui/Card";
import LoadableButton from "./ui/LoadableButton";
import Notification, { type NotificationTone } from "./ui/Notification";

type AdminRecord = { id: string; email: string };

export default function Team() {
  const { isMaster, user } = useAuthSession();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<AdminRole, "master">>("admin");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [roleByEmail, setRoleByEmail] = useState<Record<string, AdminRole>>({});

  const loadRoles = useCallback(async () => {
    if (!isMaster) return;
    try {
      const data = await fetchRbacTeam();
      const map: Record<string, AdminRole> = {};
      for (const member of data.members) {
        map[member.email] = member.role as AdminRole;
      }
      setRoleByEmail(map);
    } catch (e) {
      console.warn("RBAC team snapshot failed:", e);
    }
  }, [isMaster]);

  const fetchAdmins = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "admins"));
      setAdmins(
        snap.docs.map((d) => ({
          id: d.id,
          email: String(d.data().email ?? "").toLowerCase(),
        }))
      );
    } catch (e) {
      console.error("Failed to fetch admins", e);
    }
  }, []);

  useEffect(() => {
    void fetchAdmins();
    void loadRoles();
  }, [fetchAdmins, loadRoles]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const normalized = email.trim().toLowerCase();
      await addDoc(collection(db, "admins"), {
        email: normalized,
        role: inviteRole,
        createdAt: new Date(),
      });
      if (isMaster) {
        try {
          await syncAdminAccess({ email: normalized, action: "add", role: inviteRole });
        } catch (syncErr) {
          console.warn("API admin sync failed (Firestore invite still saved):", syncErr);
          setMsg(
            `Admin added to Firestore. API sync pending — set ADMIN_EMAILS or ADMIN_KV in Cloudflare if they get 403 on API calls.`
          );
          setEmail("");
          void fetchAdmins();
          setLoading(false);
          return;
        }
      }
      setMsg(`Admin added with role ${ROLE_LABELS[inviteRole]}. They can sign in after Firebase invite check passes.`);
      setEmail("");
      void fetchAdmins();
      void loadRoles();
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
      void fetchAdmins();
      void loadRoles();
    } catch (err: unknown) {
      setMsg("Error: " + (err instanceof Error ? err.message : "Failed to remove admin"));
    }
    setLoading(false);
  };

  const handleRoleChange = async (memberEmail: string, role: Exclude<AdminRole, "master">) => {
    if (!isMaster) return;
    setLoading(true);
    setMsg("");
    try {
      await putRbacRole({ email: memberEmail, role });
      setRoleByEmail((prev) => ({ ...prev, [memberEmail]: role }));
      setMsg(`Role updated for ${memberEmail} → ${ROLE_LABELS[role]}.`);
    } catch (err: unknown) {
      setMsg("Error: " + (err instanceof Error ? err.message : "Role update failed"));
    }
    setLoading(false);
  };

  const inputClass =
    "flex-1 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none transition-all text-[var(--color-text)]";

  const teamNotice = (() => {
    if (!msg) return null;
    if (msg.startsWith("Error:")) {
      return { tone: "error" as NotificationTone, title: "Action failed", message: msg.slice(6).trim() };
    }
    if (/pending|sync failed/i.test(msg)) {
      return { tone: "warning" as NotificationTone, title: "Partial success", message: msg };
    }
    return { tone: "success" as NotificationTone, title: "Team updated", message: msg };
  })();

  const masterEmail = user.email?.toLowerCase() ?? "";

  return (
    <div className="space-y-6 animate-fade-slide-up">
      <PageHeader
        title="Team Access"
        description="Manage who has access to Mission Control, their API allowlist entry, and RBAC role (master-only)."
      />

      <Card>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-[var(--color-text)]">
          <UserPlus className="text-[var(--color-accent)]" size={20} aria-hidden="true" />
          Invite Administrator
        </h3>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Adds the email to Firestore, syncs API allowlist (ADMIN_KV), and assigns an RBAC role.
        </p>

        {isMaster ? (
          <form onSubmit={handleInvite} className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="colleague@example.com"
                className={inputClass}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Exclude<AdminRole, "master">)}
                className="bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm min-w-[9rem]"
                aria-label="Role for new admin"
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <LoadableButton
                type="submit"
                loading={loading}
                loadingLabel="Adding…"
                className="bg-[var(--color-accent)] hover:opacity-90 text-white font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-50 shadow-[0_8px_24px_rgba(124,92,255,0.25)]"
              >
                Add Admin
              </LoadableButton>
            </div>
          </form>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">Only the master admin can invite new team members.</p>
        )}

        {teamNotice ? (
          <div className="mt-4">
            <Notification tone={teamNotice.tone} title={teamNotice.title} message={teamNotice.message} />
          </div>
        ) : null}
      </Card>

      <Card>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-[var(--color-text)]">
          <Shield className="text-[var(--color-neon)]" size={20} aria-hidden="true" />
          Authorized Administrators
        </h3>

        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl">
            <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--color-neon)_20%,transparent)] flex items-center justify-center text-[var(--color-neon)] font-bold border border-[color-mix(in_srgb,var(--color-neon)_30%,transparent)]">
              {masterEmail[0]?.toUpperCase() ?? "M"}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[var(--color-text)]">{masterEmail}</p>
              <p className="text-xs text-[var(--color-neon)] font-medium">{ROLE_LABELS.master}</p>
            </div>
          </div>

          {admins.map((record) => {
            const role = roleByEmail[record.email] ?? "admin";
            return (
              <div
                key={record.id}
                className="flex flex-wrap items-center gap-4 p-4 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl"
              >
                <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] flex items-center justify-center text-[var(--color-accent)] font-bold border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]">
                  {record.email[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--color-text)] truncate">{record.email}</p>
                  {isMaster ? (
                    <select
                      value={role === "master" ? "admin" : role}
                      onChange={(e) =>
                        void handleRoleChange(record.email, e.target.value as Exclude<AdminRole, "master">)
                      }
                      disabled={loading}
                      className="mt-1 text-xs bg-transparent border border-[var(--color-border)] rounded-lg px-2 py-1 text-[var(--color-accent-2)]"
                      aria-label={`Role for ${record.email}`}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-[var(--color-accent-2)] font-medium">{ROLE_LABELS[role as AdminRole] ?? role}</p>
                  )}
                </div>
                {isMaster && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(record)}
                    disabled={loading}
                    className="p-2 rounded-lg text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] transition-colors"
                    aria-label={`Remove ${record.email}`}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
