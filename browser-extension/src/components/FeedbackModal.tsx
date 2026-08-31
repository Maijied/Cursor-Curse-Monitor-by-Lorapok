import React, { useState } from "react";
import type { FeedbackKind } from "@lorapok/cursor-monitor-shared";
import { sendExtensionFeedback } from "../lib/feedback";

type Props = {
  open: boolean;
  onClose: () => void;
  source?: string;
};

const KIND_OPTIONS: { value: FeedbackKind; label: string }[] = [
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "general", label: "General feedback" },
];

export function FeedbackModal({ open, onClose, source = "browser-addon-modal" }: Props) {
  const [kind, setKind] = useState<FeedbackKind>("general");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  if (!open) return null;

  const onSubmit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 8) {
      setStatus("Please write at least a few words so we can help.");
      return;
    }
    setLoading(true);
    setStatus("");
    const result = await sendExtensionFeedback({
      kind,
      message: trimmed,
      source,
      email: email.trim() || undefined,
    });
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error || "Could not send feedback.");
      return;
    }
    setStatus(result.warning || result.message || "Thanks!");
    setMessage("");
    window.setTimeout(() => {
      setStatus("");
      onClose();
    }, 1400);
  };

  return (
    <div className="subscribe-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title">
      <button type="button" className="subscribe-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="subscribe-modal-panel feedback-modal-panel">
        <img src="/icons/icon-128.png" alt="" width={48} height={48} className="subscribe-modal-logo" />
        <h2 id="feedback-modal-title" className="subscribe-modal-title">Send feedback</h2>
        <p className="muted small subscribe-modal-body">
          Goes to the community Discord and Mission Control logs. Optional email if you want a reply.
        </p>
        <label className="feedback-field-label">
          Type
          <select
            className="feedback-select"
            value={kind}
            onChange={(e) => setKind(e.target.value as FeedbackKind)}
            disabled={loading}
          >
            {KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <textarea
          className="feedback-textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What happened? What would you like to see improved?"
          rows={5}
          disabled={loading}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          autoComplete="email"
          className="subscribe-promo-input"
          disabled={loading}
        />
        <div className="subscribe-promo-actions">
          <button type="button" className="btn primary" disabled={loading} onClick={() => void onSubmit()}>
            {loading ? "Sending…" : "Send to Discord"}
          </button>
          <button type="button" className="btn ghost" disabled={loading} onClick={onClose}>
            Cancel
          </button>
        </div>
        {status && <p className="muted small">{status}</p>}
      </div>
    </div>
  );
}
