import React, { useEffect, useState } from "react";
import {
  getSubscribePromptCopy,
  shouldShowSubscribePrompt,
  subscribePromptVariant,
} from "@lorapok/cursor-monitor-shared";
import { getSettings } from "../lib/storage";
import { snoozeSubscribePrompt, subscribeForProductUpdates } from "../lib/subscribe";

export function SubscribePromo() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("Subscribe");
  const [later, setLater] = useState("Maybe later");
  const [status, setStatus] = useState("");

  useEffect(() => {
    void getSettings().then((settings) => {
      const show = shouldShowSubscribePrompt({
        subscribedEmail: settings.subscribedEmail,
        snoozeUntilMs: settings.subscribeSnoozeUntil,
      });
      setVisible(show);
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
    });
  }, []);

  if (!visible) return null;

  const onSubscribe = async () => {
    if (!consent) {
      setStatus("Please agree to receive product updates.");
      return;
    }
    const result = await subscribeForProductUpdates(email, "browser-addon");
    setStatus(result.message);
    if (result.ok) setVisible(false);
  };

  const onLater = async () => {
    await snoozeSubscribePrompt();
    setVisible(false);
  };

  return (
    <section className="card subscribe-promo">
      <div className="subscribe-promo-head">
        <img src="/icons/icon-128.png" alt="" width={40} height={40} className="subscribe-promo-icon" />
        <div>
          <p className="subscribe-promo-title">{title}</p>
          <p className="muted small">{body}</p>
        </div>
      </div>
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
        <button type="button" className="btn primary" onClick={() => void onSubscribe()}>
          {cta}
        </button>
        <button type="button" className="btn ghost" onClick={() => void onLater()}>
          {later}
        </button>
      </div>
      {status && <p className="muted small">{status}</p>}
    </section>
  );
}
