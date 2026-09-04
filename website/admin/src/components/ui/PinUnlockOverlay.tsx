import { useState } from "react";
import { KeyRound } from "lucide-react";
import LoadableButton from "./LoadableButton";
import Notification from "./Notification";
import {
  loadLocalPinRecord,
  markPinUnlocked,
  verifyPin,
} from "../../lib/pin-unlock";

type PinUnlockOverlayProps = {
  email: string;
  onUnlocked: () => void;
  onUseFullSignIn: () => void;
};

/**
 * Full-screen PIN gate when Firebase session exists but quick-unlock is required.
 */
export default function PinUnlockOverlay({ email, onUnlocked, onUseFullSignIn }: PinUnlockOverlayProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const record = loadLocalPinRecord();
      if (!record) {
        onUnlocked();
        return;
      }
      const ok = await verifyPin(email, pin, record);
      if (!ok) {
        setError("Incorrect PIN. Try again or use full sign-in.");
        setLoading(false);
        return;
      }
      markPinUnlocked();
      onUnlocked();
    } catch {
      setError("PIN verification failed.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[color-mix(in_srgb,var(--color-bg-base)_88%,black)] backdrop-blur-md">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="glass-panel w-full max-w-sm p-8 border border-[var(--color-border)] shadow-2xl space-y-5"
      >
        <div className="text-center">
          <div className="inline-flex p-3 rounded-2xl bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] mb-3">
            <KeyRound size={28} className="text-[var(--color-accent)]" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-[var(--color-accent-2)] to-[var(--color-accent)] bg-clip-text text-transparent">
            Quick unlock
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-1 break-all">{email}</p>
        </div>

        {error ? <Notification tone="error" message={error} /> : null}

        <div>
          <label htmlFor="pin-unlock" className="block text-xs font-medium mb-1 text-[var(--color-muted)]">
            Enter your PIN
          </label>
          <input
            id="pin-unlock"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-center text-lg tracking-[0.4em] focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none"
            placeholder="••••"
          />
        </div>

        <LoadableButton type="submit" loading={loading} className="w-full justify-center">
          Unlock Mission Control
        </LoadableButton>

        <button
          type="button"
          onClick={onUseFullSignIn}
          className="w-full text-sm text-[var(--color-muted)] hover:text-[var(--color-accent-2)] underline-offset-2 hover:underline"
        >
          Use full sign-in instead
        </button>
      </form>
    </div>
  );
}
