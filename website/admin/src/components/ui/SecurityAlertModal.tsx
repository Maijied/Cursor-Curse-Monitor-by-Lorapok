import type { AdminSecurityFinding } from "../../lib/scanSecrets";

type Props = {
  findings: AdminSecurityFinding[];
  onDismiss: () => void;
};

export default function SecurityAlertModal({ findings, onDismiss }: Props) {
  if (!findings.length) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="alertdialog"
        className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Security Alert</h2>
          <button type="button" onClick={onDismiss} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">
            ×
          </button>
        </div>
        <p className="px-4 py-3 text-sm text-[var(--color-muted)]">
          Sensitive credentials were detected in your message. Remove them before sending.
        </p>
        <div className="mx-4 mb-3 overflow-hidden rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-bg-elevated)] text-[var(--color-muted)]">
              <tr>
                <th className="px-2 py-1 text-left">Location</th>
                <th className="px-2 py-1 text-left">Type</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id} className="border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)]">
                  <td className="px-2 py-2">{f.location}</td>
                  <td className="px-2 py-2">{f.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <button type="button" onClick={onDismiss} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs">
            Dismiss
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg bg-[var(--color-danger)] px-3 py-1.5 text-xs font-semibold text-[#1a1b1e]"
          >
            Review finding
          </button>
        </div>
      </div>
    </div>
  );
}
