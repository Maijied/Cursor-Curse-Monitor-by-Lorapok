import React from "react";
import { DISCORD_INVITE_URL, SUPPORT_EMAIL } from "@lorapok/cursor-monitor-shared";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function UsageHelpModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="subscribe-modal-overlay visible" role="presentation">
      <button
        type="button"
        className="subscribe-modal-backdrop"
        aria-label="Close usage help"
        onClick={onClose}
      />
      <div
        className="subscribe-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="usage-help-title"
      >
        <p className="popup-eyebrow">Usage guide</p>
        <h2 id="usage-help-title" className="subscribe-modal-title">
          How Cursor usage is calculated
        </h2>
        <div className="subscribe-modal-body muted small">
          <p>
            <strong>Included pool</strong> — your plan&apos;s base quota for the billing cycle.
          </p>
          <p>
            <strong>Agent credits (bonus)</strong> — extra gifted units on top of included. They
            count toward your total pool before you hit the limit.
          </p>
          <p>
            <strong>Auto / API %</strong> — usage by model class. The hero meter uses the highest of
            pool %, Auto, or API.
          </p>
          <p>
            <strong>On-demand spend</strong> — optional USD billing. Personal cap editing is only
            available when on-demand is on or you have on-demand spend.
          </p>
          <p>
            <strong>Why 100% can look stale</strong> — Cursor&apos;s API sometimes reports 100% on
            included quota while bonus credits remain. We show a warning when that happens.
          </p>
        </div>
        <div className="connect-actions">
          <a
            className="btn ghost"
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Join Discord
          </a>
          <a className="btn ghost" href={`mailto:${SUPPORT_EMAIL}`}>
            Email help
          </a>
          <button type="button" className="btn primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
