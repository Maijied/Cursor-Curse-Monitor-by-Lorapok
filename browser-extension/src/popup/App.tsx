import React, { useCallback, useEffect, useState } from "react";
import type { DashboardSnapshot } from "@lorapok/cursor-monitor-shared";
import { AnimatedGauge } from "../components/AnimatedGauge";
import { SpendChart } from "../components/SpendChart";
import { Footer } from "../components/Footer";
import { fetchSnapshot, onSnapshot, requestRefresh } from "../lib/messaging";
import { updateSettings } from "../lib/storage";
import browser from "webextension-polyfill";

function money(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n || 0);
}

export function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  useEffect(() => {
    void fetchSnapshot().then(setSnapshot);
    return onSnapshot(setSnapshot);
  }, []);

  const refresh = useCallback(() => {
    void requestRefresh().then((s) => s && setSnapshot(s));
  }, []);

  const saveBudget = async () => {
    const value = Number(budgetInput);
    if (!Number.isFinite(value) || value < 0) return;
    await updateSettings({ customBudgetLimit: value });
    setEditingBudget(false);
    refresh();
  };

  const openOptions = () => {
    void browser.runtime.openOptionsPage();
  };

  const openCursor = () => {
    void browser.tabs.create({ url: "https://cursor.com/dashboard" });
  };

  const b = snapshot?.budget;
  const connected = Boolean(snapshot?.usage && !snapshot?.error);
  const spendPercent = b
    ? b.usdBudgetActive
      ? b.budgetPercentUsed
      : b.percentUsed
    : 0;
  const spendValue = b?.hasUsdBudget
    ? money(b.spentUsd)
    : b
      ? `${b.includedUsed} / ${b.includedLimit} u`
      : "—";

  return (
    <div className="popup-root">
      <header className="popup-header">
        <h1>Budget Tracker</h1>
        <div className="header-actions">
          <button type="button" className="icon-btn" onClick={openOptions} aria-label="Settings">
            ⚙
          </button>
          <button type="button" className="icon-btn" onClick={refresh} aria-label="Refresh">
            ↻
          </button>
        </div>
      </header>

      {!connected && (
        <section className="card connect-card">
          <p className="connect-title">Connect to Cursor</p>
          <p className="muted">
            Open the Cursor dashboard while signed in, or paste your access token in Options.
          </p>
          <div className="connect-actions">
            <button type="button" className="btn primary" onClick={openCursor}>
              Open cursor.com/dashboard
            </button>
            <button type="button" className="btn ghost" onClick={openOptions}>
              Paste token manually
            </button>
          </div>
          {snapshot?.error && <p className="error-text">{snapshot.error}</p>}
        </section>
      )}

      {connected && b && (
        <>
          <section className="card gauge-card">
            <AnimatedGauge
              percent={spendPercent}
              spendLabel="Current spend"
              spendValue={spendValue}
              threshold={b.thresholdPercent}
              thresholdReached={b.thresholdReached}
            />
            <div className="stats-row">
              <div className="stat-col">
                <span className="stat-k">Budget cap</span>
                <span className="stat-v">{b.hasUsdBudget ? money(b.capUsd) : `${b.includedLimit} u`}</span>
                <button type="button" className="link-btn" onClick={() => setEditingBudget(true)}>
                  Edit budget
                </button>
              </div>
              <div className="stat-col">
                <span className="stat-k">Amount left</span>
                <span className="stat-v">
                  {b.hasUsdBudget ? money(b.leftUsd) : `${b.includedRemaining} u`}
                </span>
                <span className="stat-sub">
                  {Math.max(0, 100 - Math.round(spendPercent))}% remaining
                </span>
              </div>
              <div className="stat-col">
                <span className="stat-k">Reset date</span>
                <span className="stat-v">{b.resetDateLabel}</span>
                <span className="stat-sub">{b.daysUntilReset} days left</span>
              </div>
            </div>
            {editingBudget && (
              <div className="budget-edit">
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="USD cap (0 = plan only)"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                />
                <button type="button" className="btn primary" onClick={saveBudget}>
                  Save
                </button>
              </div>
            )}
          </section>

          <section className="card">
            <SpendChart points={snapshot.history ?? []} threshold={b.thresholdPercent} />
          </section>

          <section className="card">
            <p className="section-label">Usage meters</p>
            <div className="meter-row">
              <div className="meter-head">
                <span>Auto</span>
                <strong>{Math.round(b.autoPercentUsed)}%</strong>
              </div>
              <div className="meter-track">
                <div className="meter-fill" style={{ width: `${Math.min(100, b.autoPercentUsed)}%` }} />
              </div>
            </div>
            <div className="meter-row">
              <div className="meter-head">
                <span>API</span>
                <strong>{Math.round(b.apiPercentUsed)}%</strong>
              </div>
              <div className="meter-track">
                <div
                  className="meter-fill api"
                  style={{ width: `${Math.min(100, b.apiPercentUsed)}%` }}
                />
              </div>
            </div>
            <div className="row">
              <span className="label">Plan</span>
              <span className="value">{snapshot.usage?.membershipType ?? "—"}</span>
            </div>
            {b.onDemandEnabled && (
              <div className="row">
                <span className="label">On-demand</span>
                <span className="value">{money(b.spentUsd)}</span>
              </div>
            )}
          </section>

          <section className="card ide-callout">
            <p className="section-label">IDE extension only</p>
            <p className="muted small">
              Local session insights and Composer 2.5 fallback are available in the VS Code / Cursor
              extension.
            </p>
            <a
              className="link-btn"
              href="https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get IDE extension →
            </a>
          </section>
        </>
      )}

      <Footer />
    </div>
  );
}
