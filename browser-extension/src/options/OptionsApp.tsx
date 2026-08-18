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
import { requestRefresh } from "../lib/messaging";
import "../popup/styles.css";

export function OptionsApp() {
  const [token, setToken] = useState("");
  const [budget, setBudget] = useState("0");
  const [threshold, setThreshold] = useState("80");
  const [poll, setPoll] = useState("5");
  const [telemetry, setTelemetry] = useState(false);
  const [saved, setSaved] = useState(false);
  const [securityFindings, setSecurityFindings] = useState<SecurityFinding[]>([]);

  useEffect(() => {
    void getSettings().then((s) => {
      setToken(s.accessToken ?? "");
      setBudget(String(s.customBudgetLimit));
      setThreshold(String(s.warnAtPercent));
      setPoll(String(s.pollIntervalMinutes));
      setTelemetry(s.anonymousUsageStats);
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
    });
    await requestRefresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

        <div className="options-actions">
          <button type="submit" className="btn primary">Save settings</button>
          <button type="button" className="btn ghost" onClick={() => void disconnect()}>
            Disconnect
          </button>
          {saved && <span className="muted">Saved.</span>}
        </div>
      </form>

      <Footer />
    </div>
  );
}
