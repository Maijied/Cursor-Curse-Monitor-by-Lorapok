import { useState, useEffect, useCallback } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserPlus, Shield, Trash2 } from "lucide-react";
import { fetchRbacTeam, putRbacRole, syncAdminAccess, type RbacMember } from "../lib/api";
import { useAuthSession } from "../lib/auth-context";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AdminRole } from "../lib/rbac";
import PageHeader from "./layout/PageHeader";
import Card from "./ui/Card";
import LoadableButton from "./ui/LoadableButton";
import Notification, { type NotificationTone } from "./ui/Notification";
import ReadOnlyAclBanner from "./ui/ReadOnlyAclBanner";

type AdminRecord = { id: string; email: string };

export default function Team() {
  const { user, hasPermission } = useAuthSession();
  const canManageTeam = hasPermission("team.manage");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<AdminRole, "master">>("admin");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [members, setMembers] = useState<RbacMember[]>([]);
  const [legacyFirestore, setLegacyFirestore] = useState<AdminRecord[]>([]);

  const loadRoles = useCallback(async () => {
    try {
      const data = await fetchRbacTeam();
      setMembers(data.members);
      return data.members;
    } catch (e) {
      console.warn("RBAC team snapshot failed:", e);
      return [];
    }
  }, []);

  const fetchLegacyFirestoreAdmins = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "admins"));
      const rows = snap.docs.map((d) => ({
        id: d.id,
        email: String(d.data().email ?? "").toLowerCase(),
      }));
      setLegacyFirestore(rows);
      return rows;
    } catch (e) {
      console.error("Failed to fetch Firestore admins", e);
      return [];
    }
  }, []);

  const reconcileLegacyFirestore = useCallback(
    async (snapshot: RbacMember[], firestoreRows: AdminRecord[]) => {
      if (!canManageTeam || firestoreRows.length === 0) return;
      const allowed = new Set(snapshot.map((m) => m.email));
      const masterEmail = user.email?.toLowerCase() ?? "";
      for (const record of firestoreRows) {
        if (!record.email || record.email === masterEmail || allowed.has(record.email)) continue;
        try {
          await syncAdminAccess({ email: record.email, action: "add", role: "admin" });
        } catch (syncErr) {
          console.warn(`Legacy Firestore admin reconcile failed for ${record.email}:`, syncErr);
        }
      }
    },
    [canManageTeam, user.email]
  );

  useEffect(() => {
    void (async () => {
      const snapshot = await loadRoles();
      if (!canManageTeam) return;
      const firestoreRows = await fetchLegacyFirestoreAdmins();
      await reconcileLegacyFirestore(snapshot, firestoreRows);
      await loadRoles();
    })();
  }, [canManageTeam, fetchLegacyFirestoreAdmins, loadRoles, reconcileLegacyFirestore]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTeam) return;
    setLoading(true);
    setMsg("");
    try {
      const normalized = email.trim().toLowerCase();
      await syncAdminAccess({ email: normalized, action: "add", role: inviteRole });
      try {
        await addDoc(collection(db, "admins"), {
          email: normalized,
          role: inviteRole,
          createdAt: new Date(),
        });
      } catch (firestoreErr) {
        console.warn("Firestore mirror failed (API allowlist is authoritative):", firestoreErr);
      }
      setMsg(`Admin added with role ${ROLE_LABELS[inviteRole]}. They can sign in after Firebase auth.`);
      setEmail("");
      await loadRoles();
      void fetchLegacyFirestoreAdmins();
    } catch (err: unknown) {
      setMsg("Error: " + (err instanceof Error ? err.message : "Failed to add admin"));
    }
    setLoading(false);
  };

  const handleRemove = async (memberEmail: string, firestoreId?: string) => {
    if (!canManageTeam) return;
    if (!window.confirm(`Remove ${memberEmail} from admin access?`)) return;
    setLoading(true);
    setMsg("");
    try {
      await syncAdminAccess({ email: memberEmail, action: "remove" });
      if (firestoreId) {
        try {
          await deleteDoc(doc(db, "admins", firestoreId));
        } catch (firestoreErr) {
          console.warn("Firestore delete failed:", firestoreErr);
        }
      }
      setMsg(`${memberEmail} removed.`);
      await loadRoles();
      void fetchLegacyFirestoreAdmins();
    } catch (err: unknown) {
      setMsg("Error: " + (err instanceof Error ? err.message : "Failed to remove admin"));
    }
    setLoading(false);
  };

  const handleRoleChange = async (memberEmail: string, role: Exclude<AdminRole, "master">) => {
    if (!canManageTeam) return;
    setLoading(true);
    setMsg("");
    try {
      await putRbacRole({ email: memberEmail, role });
      setMembers((prev) =>
        prev.map((m) => (m.email === memberEmail ? { ...m, role } : m))
      );
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
  const firestoreIdByEmail = new Map(legacyFirestore.map((row) => [row.email, row.id]));
  const invitedMembers = members.filter((m) => m.email !== masterEmail);

  return (
    <div className="space-y-6 animate-fade-slide-up">
      <PageHeader
        title="Team Access"
        description="Manage who has access to Mission Control, their API allowlist entry, and RBAC role (master-only)."
      />

      {!canManageTeam ? (
        <ReadOnlyAclBanner permission="team.manage" feature="Team invites and role changes" />
      ) : null}

      <Card>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-[var(--color-text)]">
          <UserPlus className="text-[var(--color-accent)]" size={20} aria-hidden="true" />
          Invite Administrator
        </h3>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Syncs the API allowlist (ADMIN_KV) first, then mirrors to Firestore. Invited admins can sign in without
          using the master email.
        </p>

        {canManageTeam ? (
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
          <p className="text-sm text-[var(--color-muted)]">
            Team management requires <code className="text-[10px]">team.manage</code> (master admin).
          </p>
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

          {invitedMembers.map((member) => {
            const role = member.role as AdminRole;
            const firestoreId = firestoreIdByEmail.get(member.email);
            return (
              <div
                key={member.email}
                className="flex flex-wrap items-center gap-4 p-4 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl"
              >
                <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] flex items-center justify-center text-[var(--color-accent)] font-bold border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]">
                  {member.email[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--color-text)] truncate">{member.email}</p>
                  <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide">
                    {member.source} allowlist
                  </p>
                  {canManageTeam ? (
                    <select
                      value={role === "master" ? "admin" : role}
                      onChange={(e) =>
                        void handleRoleChange(member.email, e.target.value as Exclude<AdminRole, "master">)
                      }
                      disabled={loading}
                      className="mt-1 text-xs bg-transparent border border-[var(--color-border)] rounded-lg px-2 py-1 text-[var(--color-accent-2)]"
                      aria-label={`Role for ${member.email}`}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-[var(--color-accent-2)] font-medium">
                      {ROLE_LABELS[role as AdminRole] ?? role}
                    </p>
                  )}
                </div>
                {canManageTeam && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(member.email, firestoreId)}
                    disabled={loading}
                    className="p-2 rounded-lg text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] transition-colors"
                    aria-label={`Remove ${member.email}`}
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
