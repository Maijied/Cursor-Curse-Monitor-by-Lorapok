import React, { useEffect, useState } from "react";
import {
  getSubscribePromptCopy,
  shouldShowSubscribePrompt,
  subscribePromptVariant,
  SUBSCRIBE_PROMPT_DELAY_MS,
} from "@lorapok/cursor-monitor-shared";
import { getSettings } from "../lib/storage";
import { declineSubscribePrompt, snoozeSubscribePrompt, subscribeForProductUpdates } from "../lib/subscribe";

export function SubscribeModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("Get release updates");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("Subscribe");
  const [later, setLater] = useState("Maybe later");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let timer: number | undefined;
    void getSettings().then((settings) => {
      const show = shouldShowSubscribePrompt({
        subscribedEmail: settings.subscribedEmail,
        snoozeUntilMs: settings.subscribeSnoozeUntil,
        declined: settings.subscribeDeclined,
      });
      if (!show) return;
      const variant = subscribePromptVariant({
        subscribedEmail: settings.subscribedEmail,
        snoozeUntilMs: settings.subscribeSnoozeUntil,
      });
      const copy = getSubscribePromptCopy(variant);
      setTitle(copy.title);
      setBody(copy.body);
      setCta(copy.cta);
      setLater(copy.later);
      setEmail(settings.email ?? settings.subscribedEmail ?? "");
      timer = window.setTimeout(() => setOpen(true), SUBSCRIBE_PROMPT_DELAY_MS);
    });
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!open) return null;

  const onSubscribe = async () => {
    if (!consent) {
      setStatus("Please agree to receive product updates.");
      return;
    }
    setLoading(true);
    setStatus("");
    const result = await subscribeForProductUpdates(email, "browser-addon-modal");
    setLoading(false);
    setStatus(result.message);
    if (result.ok) setOpen(false);
  };

  const onLater = async () => {
    await snoozeSubscribePrompt();
    setOpen(false);
  };

  const onDecline = async () => {
    await declineSubscribePrompt();
    setOpen(false);
  };

  return (
    <div className="subscribe-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="subscribe-modal-title">
      <button type="button" className="subscribe-modal-backdrop" aria-label="Close" onClick={() => void onLater()} />
      <div className="subscribe-modal-panel">
        <img src="/icons/icon-128.png" alt="" width={56} height={56} className="subscribe-modal-logo" />
        <h2 id="subscribe-modal-title" className="subscribe-modal-title">{title}</h2>
        <p className="muted small subscribe-modal-body">{body}</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="subscribe-promo-input"
        />
        <label className="subscribe-promo-consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          I agree to receive product updates from Lorapok Labs
        </label>
        <div className="subscribe-promo-actions">
          <button type="button" className="btn primary" disabled={loading} onClick={() => void onSubscribe()}>
            {loading ? <span className="subscribe-inline-loader" aria-hidden="true" /> : null}
            {loading ? "Subscribing…" : cta}
          </button>
          <button type="button" className="btn ghost" disabled={loading} onClick={() => void onLater()}>
            {later}
          </button>
          <button type="button" className="btn ghost subscribe-decline" disabled={loading} onClick={() => void onDecline()}>
            No thanks
          </button>
        </div>
        {status && <p className="muted small">{status}</p>}
      </div>
    </div>
  );
}
