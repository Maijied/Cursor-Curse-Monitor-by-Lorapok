import { useCallback, useEffect, useState } from "react";
import { User, Shield, KeyRound, Trash2 } from "lucide-react";
import { auth } from "../../lib/firebase";
import Card from "./Card";
import Badge from "./Badge";
import LoadableButton from "./LoadableButton";
import Notification, { type NotificationTone } from "./Notification";
import {
  createPinRecord,
  saveLocalPinRecord,
  validatePinInput,
  pinEnabledForEmail,
  clearPinUnlockSession,
} from "../../lib/pin-unlock";
import { fetchAuthMe, putAuthProfile } from "../../lib/api";
import { ROLE_LABELS, type AdminRole } from "../../lib/rbac";

/**
 * Profile & quick-unlock PIN — synced with Mission Control glass aesthetic.
 */
export default function ProfileSettingsCard() {
  const user = auth.currentUser;
  const [role, setRole] = useState<AdminRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [displayNameOverride, setDisplayNameOverride] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: NotificationTone; text: string } | null>(null);

  const pinActive = pinEnabledForEmail(user?.email);

  const load = useCallback(async () => {
    try {
      const data = await fetchAuthMe();
      setRole((data.user.role as AdminRole) ?? "admin");
      setPermissions(data.user.permissions ?? []);
      setDisplayNameOverride(data.user.profile?.displayNameOverride ?? "");
    } catch {
      setRole(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveProfile = async () => {
    if (!user?.email) return;
    setLoading(true);
    setMessage(null);
    try {
      await putAuthProfile({ displayNameOverride });
      setMessage({ tone: "success", text: "Profile preferences saved." });
      await load();
    } catch (err: unknown) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setLoading(false);
  };

  const handleSetPin = async () => {
    if (!user?.email) return;
    const err = validatePinInput(pin);
    if (err) {
      setMessage({ tone: "error", text: err });
      return;
    }
    if (pin !== pinConfirm) {
      setMessage({ tone: "error", text: "PIN confirmation does not match." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const record = await createPinRecord(user.email, pin);
      saveLocalPinRecord(record);
      await putAuthProfile({
        pinHash: record.hash,
        pinSalt: record.salt,
        pinPlain: pin,
        displayNameOverride,
      });
      setPin("");
      setPinConfirm("");
      clearPinUnlockSession();
      setMessage({
        tone: "success",
        text: "Quick-unlock PIN enabled. You will be prompted on return visits (device-local + KV verifier backup).",
      });
      await load();
    } catch (err: unknown) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "PIN setup failed" });
    }
    setLoading(false);
  };

  const handleRemovePin = async () => {
    if (!window.confirm("Remove quick-unlock PIN on this device?")) return;
    setLoading(true);
    setMessage(null);
    try {
      saveLocalPinRecord(null);
      await putAuthProfile({ clearPin: true });
      clearPinUnlockSession();
      setMessage({ tone: "success", text: "PIN removed." });
      await load();
    } catch (err: unknown) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Remove failed" });
    }
    setLoading(false);
  };

  const photo = user?.photoURL;
  const displayName = displayNameOverride || user?.displayName || user?.email?.split("@")[0] || "Admin";
  const providers = user?.providerData?.map((p) => p.providerId).filter(Boolean) ?? [];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <User size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Profile & quick unlock
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Your Mission Control identity, role, and optional PIN for faster return visits (like cred vault pin — never stored in plaintext).
          </p>
        </div>
        {role ? <Badge variant="synced">{ROLE_LABELS[role]}</Badge> : null}
      </div>

      {message ? <Notification tone={message.tone} message={message.text} /> : null}

      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="flex flex-col items-center sm:items-start gap-3">
          {photo ? (
            <img
              src={photo}
              alt=""
              className="w-20 h-20 rounded-2xl border border-[var(--color-border)] object-cover shadow-lg"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] flex items-center justify-center text-2xl font-bold text-[var(--color-accent)]"
              aria-hidden="true"
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-center sm:text-left text-sm">
            <p className="font-semibold text-[var(--color-text)]">{displayName}</p>
            <p className="text-[var(--color-muted)] break-all">{user?.email}</p>
            {user?.emailVerified ? (
              <span className="text-[var(--color-neon)] text-xs">Email verified</span>
            ) : (
              <span className="text-amber-400 text-xs">Email not verified</span>
            )}
          </div>
        </div>

        <dl className="flex-1 grid gap-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt className="text-[var(--color-muted)]">Sign-in providers</dt>
            <dd className="font-mono text-xs text-right">{providers.join(", ") || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt className="text-[var(--color-muted)]">Permissions</dt>
            <dd className="text-xs text-right max-w-[14rem]">{permissions.length} granted</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-muted)]">Quick PIN</dt>
            <dd>{pinActive ? <Badge variant="synced">Enabled</Badge> : <Badge variant="warn">Off</Badge>}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-4 border-t border-[var(--color-border)] pt-6">
        <div>
          <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]" htmlFor="profile-display-name">
            Display name override
          </label>
          <input
            id="profile-display-name"
            type="text"
            value={displayNameOverride}
            onChange={(e) => setDisplayNameOverride(e.target.value)}
            className="w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm"
            placeholder={user?.displayName ?? "Mission Control display name"}
            maxLength={80}
          />
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Shown in profile header only — does not change Firebase or outbound mail From addresses.
          </p>
        </div>
        <LoadableButton type="button" loading={loading} onClick={() => void handleSaveProfile()}>
          Save profile
        </LoadableButton>
      </div>

      <div className="space-y-4 border-t border-[var(--color-border)] pt-6 mt-6">
        <h4 className="font-medium flex items-center gap-2">
          <KeyRound size={16} className="text-[var(--color-accent-2)]" aria-hidden="true" />
          Quick-unlock PIN
        </h4>
        <p className="text-sm text-[var(--color-muted)]">
          Optional 4–6 digit PIN to unlock Mission Control when Firebase session is still active (Remember me). Hash stored locally; verifier backup in ADMIN_KV. Not a replacement for full sign-in when the session expires.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]" htmlFor="profile-pin">
              New PIN
            </label>
            <input
              id="profile-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm tracking-widest"
              placeholder="••••"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]" htmlFor="profile-pin-confirm">
              Confirm PIN
            </label>
            <input
              id="profile-pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm tracking-widest"
              placeholder="••••"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <LoadableButton type="button" loading={loading} onClick={() => void handleSetPin()}>
            <Shield size={16} className="mr-1.5" aria-hidden="true" />
            Set PIN
          </LoadableButton>
          {pinActive ? (
            <button
              type="button"
              onClick={() => void handleRemovePin()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)]"
            >
              <Trash2 size={16} aria-hidden="true" />
              Remove PIN
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
