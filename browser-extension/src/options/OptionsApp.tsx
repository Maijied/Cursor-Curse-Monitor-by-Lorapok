import React, { useEffect, useState } from "react";
import type { SecurityFinding } from "@lorapok/cursor-monitor-shared";
import { Footer } from "../components/Footer";
import { SecurityAlertModal } from "../components/SecurityAlertModal";
import { scanPasteField } from "../lib/securityScan";
import {
  clearAuth,
  getSettings,
  saveToken,
  updateSettings,
} from "../lib/storage";
import {
  getSubscribePromptCopy,
  shouldShowSubscribePrompt,
  subscribePromptVariant,
  SUPPORTED_IDE_WRAPPERS,
  SUPPORTED_IDE_WRAPPERS_HEADLINE,
  SUPPORTED_IDE_WRAPPERS_SUBLINE,
  COMMUNITY_DOWNLOADS_SITE_DATA_URL,
  formatCommunityDownloadsBreakdown,
  formatCommunityDownloadsHeadline,
  parseCommunityDownloadsFromSiteData,
  type CommunityDownloadStats,
} from "@lorapok/cursor-monitor-shared";
import { snoozeSubscribePrompt, subscribeForProductUpdates } from "../lib/subscribe";
import { refreshProductNotice } from "../lib/productNotices";
import { requestRefresh } from "../lib/messaging";
import "../popup/styles.css";

export function OptionsApp() {
  const [token, setToken] = useState("");
  const [budget, setBudget] = useState("0");
  const [threshold, setThreshold] = useState("80");
  const [poll, setPoll] = useState("5");
  const [telemetry, setTelemetry] = useState(false);
  const [productNotices, setProductNotices] = useState(true);
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribeConsent, setSubscribeConsent] = useState(false);
  const [subscribeMessage, setSubscribeMessage] = useState("");
  const [showSubscribeSection, setShowSubscribeSection] = useState(true);
  const [subscribeCopy, setSubscribeCopy] = useState({ title: "", body: "", cta: "", later: "" });
  const [saved, setSaved] = useState(false);
  const [securityFindings, setSecurityFindings] = useState<SecurityFinding[]>([]);
  const [communityStats, setCommunityStats] = useState<CommunityDownloadStats | null>(null);

  useEffect(() => {
    void getSettings().then((s) => {
      setToken(s.accessToken ?? "");
      setBudget(String(s.customBudgetLimit));
      setThreshold(String(s.warnAtPercent));
      setPoll(String(s.pollIntervalMinutes));
      setTelemetry(s.anonymousUsageStats);
      setProductNotices(s.productNotices);
      setSubscribeEmail(s.subscribedEmail ?? s.email ?? "");
      const show = shouldShowSubscribePrompt({
        subscribedEmail: s.subscribedEmail,
        snoozeUntilMs: s.subscribeSnoozeUntil,
        declined: s.subscribeDeclined,
      });
      setShowSubscribeSection(show);
      if (show) {
        const variant = subscribePromptVariant({
          subscribedEmail: s.subscribedEmail,
          snoozeUntilMs: s.subscribeSnoozeUntil,
        });
        setSubscribeCopy(getSubscribePromptCopy(variant));
      }
    });
  }, []);

  useEffect(() => {
    void fetch(COMMUNITY_DOWNLOADS_SITE_DATA_URL, { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setCommunityStats(parseCommunityDownloadsFromSiteData(data));
      })
      .catch(() => {
        // Fail closed — no placeholder counts.
      });
  }, []);

  const checkTokenPaste = (value: string) => {
    const findings = scanPasteField(value, "Options paste", true);
    setSecurityFindings(findings);
    return findings.length === 0;
  };

  const save = async () => {
    if (token.trim() && !checkTokenPaste(token)) {
      return;
    }
    if (token.trim()) {
      await saveToken(token.trim());
    }
    await updateSettings({
      customBudgetLimit: Number(budget) || 0,
      warnAtPercent: Number(threshold) || 80,
      pollIntervalMinutes: Number(poll) || 5,
      anonymousUsageStats: telemetry,
      productNotices,
    });
    await requestRefresh();
    void refreshProductNotice(productNotices);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const subscribe = async () => {
    if (!subscribeConsent) {
      setSubscribeMessage("Please agree to receive product updates.");
      return;
    }
    const result = await subscribeForProductUpdates(subscribeEmail, "browser-addon-options");
    setSubscribeMessage(result.message);
    if (result.ok) {
      await updateSettings({ subscribedEmail: subscribeEmail.trim().toLowerCase() });
      setShowSubscribeSection(false);
    }
  };

  const snoozeSubscribe = async () => {
    await snoozeSubscribePrompt();
    setShowSubscribeSection(false);
    setSubscribeMessage("We'll remind you in a few days.");
  };

  const disconnect = async () => {
    await clearAuth();
    setToken("");
    setSecurityFindings([]);
    await requestRefresh();
  };

  return (
    <div className="options-root popup-root" style={{ width: "auto", maxHeight: "none" }}>
      {securityFindings.length > 0 && (
        <SecurityAlertModal
          findings={securityFindings}
          onDismiss={() => setSecurityFindings([])}
          onReview={() => {
            setSecurityFindings([]);
            document.getElementById("token")?.focus();
            document.getElementById("token")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      )}
      <h1>Cursor Curse Monitor — Settings</h1>
      <p className="muted">
        Connect via cursor.com/dashboard (auto) or paste your Cursor access token below.
      </p>

      <form className="options-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label htmlFor="token">Access token (manual)</label>
        <textarea
          id="token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onBlur={(e) => { void checkTokenPaste(e.target.value); }}
          placeholder="Bearer token from cursorAuth/accessToken in state.vscdb"
          autoComplete="off"
        />

        <label htmlFor="budget">Personal budget cap (USD, 0 = plan only)</label>
        <input id="budget" type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} />

        <label htmlFor="threshold">Warning threshold (%)</label>
        <input id="threshold" type="number" min={1} max={100} value={threshold} onChange={(e) => setThreshold(e.target.value)} />

        <label htmlFor="poll">Poll interval (minutes)</label>
        <input id="poll" type="number" min={1} max={60} value={poll} onChange={(e) => setPoll(e.target.value)} />

        <label>
          <input
            type="checkbox"
            checked={telemetry}
            onChange={(e) => setTelemetry(e.target.checked)}
          />{" "}
          Opt-in anonymous usage heartbeat (no tokens or emails sent)
        </label>

        <label>
          <input
            type="checkbox"
            checked={productNotices}
            onChange={(e) => setProductNotices(e.target.checked)}
          />{" "}
          Show Lorapok product notices (releases &amp; features)
        </label>

        <hr style={{ border: "none", borderTop: "1px solid rgba(148,163,184,0.2)", margin: "16px 0" }} />
        {showSubscribeSection ? (
          <>
            <h2 style={{ fontSize: "1rem", margin: "0 0 8px" }}>{subscribeCopy.title || "Release update emails"}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {subscribeCopy.body ||
                "Marketplaces do not share installer emails. Opt in here if you want release notes in your inbox."}
            </p>
            <label htmlFor="subscribe-email">Email</label>
            <input
              id="subscribe-email"
              type="email"
              value={subscribeEmail}
              onChange={(e) => setSubscribeEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <label>
              <input
                type="checkbox"
                checked={subscribeConsent}
                onChange={(e) => setSubscribeConsent(e.target.checked)}
              />{" "}
              I agree to receive product updates from Lorapok Labs
            </label>
            <div className="options-actions">
              <button type="button" className="btn primary" onClick={() => void subscribe()}>
                {subscribeCopy.cta || "Subscribe to updates"}
              </button>
              <button type="button" className="btn ghost" onClick={() => void snoozeSubscribe()}>
                {subscribeCopy.later || "Maybe later"}
              </button>
              {subscribeMessage && <span className="muted">{subscribeMessage}</span>}
            </div>
          </>
        ) : (
          subscribeEmail && (
            <p className="muted" style={{ margin: 0 }}>
              Subscribed as <strong>{subscribeEmail}</strong>. Manage preferences from your inbox.
            </p>
          )
        )}

        <div className="options-actions">
          <button type="submit" className="btn primary">Save settings</button>
          <button type="button" className="btn ghost" onClick={() => void disconnect()}>
            Disconnect
          </button>
          {saved && <span className="muted">Saved.</span>}
        </div>
      </form>

      <section className="about-product" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: "1rem", margin: "0 0 8px" }}>About this product</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          <strong>{SUPPORTED_IDE_WRAPPERS_HEADLINE}</strong> — {SUPPORTED_IDE_WRAPPERS_SUBLINE}
        </p>
        <ul className="about-features" style={{ margin: "12px 0", paddingLeft: 18, color: "var(--muted)", fontSize: "0.9rem" }}>
          <li>Live Cursor usage quota, billing cycle, and on-demand spend</li>
          <li>Personal budget cap with threshold warnings</li>
          <li>Automatic Composer 2.5 (Fast off) fallback when limits are crossed</li>
          <li>Local credential paste guard in the browser popup</li>
          <li>Private — tokens and usage stay on your machine</li>
        </ul>
        <p className="muted" style={{ margin: "12px 0 8px", fontSize: "0.85rem" }}>
          <strong>Community downloads:</strong>{" "}
          {communityStats
            ? formatCommunityDownloadsHeadline(communityStats)
            : "Loading marketplace stats…"}
        </p>
        {communityStats && (
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>
            {formatCommunityDownloadsBreakdown(communityStats)}
          </p>
        )}
        <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
          <strong>Supported IDEs:</strong>{" "}
          {SUPPORTED_IDE_WRAPPERS.map((ide) => ide.name).join(", ")}.
        </p>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          More Lorapok Labs tools:{" "}
          <a href="https://lorapok.tech" target="_blank" rel="noopener noreferrer">lorapok.tech</a>
        </p>
      </section>

      <Footer />
    </div>
  );
}
