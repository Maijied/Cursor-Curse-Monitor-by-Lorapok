import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardSnapshot } from "@lorapok/cursor-monitor-shared";
import {
  buildUsageAnalytics,
  type UsageGroupBy,
  type UsageRangePreset,
} from "@lorapok/cursor-monitor-shared";
import { AnimatedGauge } from "../components/AnimatedGauge";
import { UsageAnalyticsChart } from "../components/UsageAnalyticsChart";
import { Footer } from "../components/Footer";
import { UsageHelpModal } from "../components/UsageHelpModal";
import { SubscribeModal } from "../components/SubscribeModal";
import { FeedbackModal } from "../components/FeedbackModal";
import { WhatsNewCard } from "../components/WhatsNewCard";
import { fetchSnapshot, onSnapshot, requestRefresh } from "../lib/messaging";
import { getSettings, setActiveAccount, updateSettings } from "../lib/storage";
import browser from "webextension-polyfill";

function money(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n || 0);
}

declare const __EXTENSION_VERSION__: string;

export function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showUsageHelp, setShowUsageHelp] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [usageRange, setUsageRange] = useState<UsageRangePreset>("7d");
  const [usageGroupBy, setUsageGroupBy] = useState<UsageGroupBy>("autoApi");
  const connectPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void fetchSnapshot().then((data) => {
      setSnapshot(data);
      setLoading(false);
    });
    return onSnapshot((data) => {
      setSnapshot(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    void getSettings().then((settings) => {
      if (settings.lastSeenVersion !== __EXTENSION_VERSION__) {
        setShowWhatsNew(true);
      }
    });
  }, []);

  const dismissWhatsNew = async () => {
    await updateSettings({ lastSeenVersion: __EXTENSION_VERSION__ });
    setShowWhatsNew(false);
  };

  const refresh = useCallback(() => {
    void requestRefresh().then((s) => s && setSnapshot(s));
  }, []);

  const switchAccount = async (accountId: string) => {
    if (!accountId || accountId === snapshot?.activeAccountId) return;
    setSwitching(true);
    await setActiveAccount(accountId);
    const next = await requestRefresh();
    if (next) setSnapshot(next);
    setSwitching(false);
  };

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
    setConnecting(true);
    void browser.tabs.create({ url: "https://cursor.com/dashboard" });
    let attempts = 0;
    if (connectPollRef.current) {
      clearInterval(connectPollRef.current);
    }
    connectPollRef.current = setInterval(() => {
      attempts += 1;
      void requestRefresh().then((next) => {
        if (next?.usage && !next.error) {
          setSnapshot(next);
          setConnecting(false);
          if (connectPollRef.current) {
            clearInterval(connectPollRef.current);
            connectPollRef.current = null;
          }
        } else if (attempts >= 15) {
          setConnecting(false);
          if (connectPollRef.current) {
            clearInterval(connectPollRef.current);
            connectPollRef.current = null;
          }
        }
      });
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (connectPollRef.current) {
        clearInterval(connectPollRef.current);
      }
    };
  }, []);

  const b = snapshot?.budget;
  const connected = Boolean(snapshot?.usage && !snapshot?.error);
  const blocked = !loading && !connected;
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

  const usageAnalytics = useMemo(() => {
    if (!snapshot?.budget) return null;
    return buildUsageAnalytics({
      budget: snapshot.budget,
      usage: snapshot.usage,
      history: snapshot.history,
      onDemandSpendUsd: snapshot.onDemandSpendUsd,
      range: usageRange,
      groupBy: usageGroupBy,
    });
  }, [snapshot, usageRange, usageGroupBy]);

  return (
    <div className={`popup-root${blocked ? " cursor-missing" : ""}${loading ? " is-loading" : ""}`}>
      {loading && (
        <div className="popup-loading" role="status" aria-live="polite">
          <div className="popup-loading-spinner" aria-hidden="true" />
          <p>Loading usage…</p>
        </div>
      )}
      {blocked && (
        <div className="cursor-missing-overlay" role="alertdialog" aria-labelledby="cursor-missing-title">
          <div className="cursor-missing-card">
            <p className="cursor-missing-eyebrow">No Cursor AI found</p>
            <h2 id="cursor-missing-title">Connect to Cursor first</h2>
            <p className="muted">
              Open <strong>cursor.com/dashboard</strong> while signed in, or add another Cursor
              account by pasting a token in Options.
              Works with every major VS Code–based AI IDE when you install the desktop extension.
            </p>
            <p className="muted lorapok-cta">
              Explore more Lorapok Labs tools at{" "}
              <a href="https://lorapok.tech" target="_blank" rel="noopener noreferrer">lorapok.tech</a>
            </p>
            {snapshot?.accounts && snapshot.accounts.length > 1 && (
              <div className="account-switcher overlay-accounts">
                <label htmlFor="popup-account-overlay">Switch saved account</label>
                <select
                  id="popup-account-overlay"
                  value={snapshot.activeAccountId ?? ""}
                  disabled={switching}
                  onChange={(e) => void switchAccount(e.target.value)}
                  aria-label="Switch Cursor account"
                >
                  {snapshot.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="connect-actions">
              <button type="button" className="btn primary" onClick={openCursor} disabled={connecting}>
                {connecting ? "Waiting for sign-in…" : "Sign in with browser"}
              </button>
              <button type="button" className="btn ghost" onClick={openOptions}>
                Paste access token
              </button>
            </div>
            {snapshot?.error && <p className="error-text">{snapshot.error}</p>}
          </div>
        </div>
      )}
      <header className="popup-header">
        <div>
          <p className="popup-eyebrow">Lorapok Labs</p>
          <h1>Cursor Curse Monitor</h1>
        </div>
        <div className="header-actions">
          <button type="button" className="icon-btn" onClick={openOptions} aria-label="Settings">
            ⚙
          </button>
          <button type="button" className="icon-btn" onClick={refresh} aria-label="Refresh">
            ↻
          </button>
        </div>
      </header>

      {((snapshot?.accounts && snapshot.accounts.length > 0) || switching) && (
        <div className={`account-switcher${switching ? " is-syncing" : ""}`}>
          <label htmlFor="popup-account">Cursor account</label>
          <select
            id="popup-account"
            value={snapshot?.activeAccountId ?? ""}
            disabled={switching}
            onChange={(e) => void switchAccount(e.target.value)}
            aria-label="Switch Cursor account"
            aria-busy={switching}
          >
            {(snapshot?.accounts ?? []).map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
          {switching ? (
            <p className="account-sync-status" role="status" aria-live="polite">
              <span className="account-sync-spinner" aria-hidden="true" />
              Syncing account…
            </p>
          ) : null}
          {snapshot?.email && !switching ? <p className="account-email">{snapshot.email}</p> : null}
        </div>
      )}

      {showWhatsNew && <WhatsNewCard onDismiss={() => void dismissWhatsNew()} />}

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
                <span className="stat-k">{b.usdBudgetActive ? "Spend cap" : "Total pool"}</span>
                <span className="stat-v">
                  {b.usdBudgetActive ? money(b.capUsd) : `${b.includedLimit} u`}
                </span>
                {b.usdBudgetActive ? (
                  <button
                    type="button"
                    className={`cap-edit-btn${editingBudget ? " is-open" : ""}`}
                    onClick={() => {
                      setEditingBudget((open) => !open);
                      if (!editingBudget) {
                        setBudgetInput(String(b.capUsd ?? snapshot.customBudgetLimit ?? 0));
                      }
                    }}
                    aria-expanded={editingBudget}
                  >
                    <span className="cap-icon" aria-hidden="true">
                      ✎
                    </span>
                    <span>Edit budget cap</span>
                  </button>
                ) : null}
              </div>
              <div className="stat-col">
                <span className="stat-k">{b.usdBudgetActive ? "Spend left" : "Quota left"}</span>
                <span className="stat-v">
                  {b.usdBudgetActive ? money(b.leftUsd) : `${b.includedRemaining} u`}
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
            {editingBudget && b.usdBudgetActive && (
              <div className="budget-edit-panel open">
                <label className="budget-edit-label" htmlFor="popup-budget-cap">
                  Personal budget cap (USD)
                </label>
                <div className="budget-edit">
                  <input
                    id="popup-budget-cap"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="USD cap (0 = plan only)"
                    aria-label="Custom budget cap in USD"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                  />
                  <button type="button" className="btn primary" onClick={saveBudget}>
                    Save cap
                  </button>
                </div>
              </div>
            )}
          </section>

          <UsageAnalyticsChart
            analytics={usageAnalytics}
            onRangeChange={setUsageRange}
            onGroupByChange={setUsageGroupBy}
          />

          <section className="card">
            <div className="section-head-row">
              <p className="section-label" style={{ margin: 0 }}>
                Usage meters
              </p>
              <button
                type="button"
                className="usage-help-btn"
                onClick={() => setShowUsageHelp(true)}
                aria-label="Usage help"
              >
                ?
              </button>
            </div>
            {b.staleLimitBanner && b.staleLimitMessage ? (
              <p className="stale-banner" role="status">
                {b.staleLimitMessage}
              </p>
            ) : null}
            <div className="meter-row">
              <div className="meter-head">
                <span>Pool</span>
                <strong>{Math.round(b.percentUsed)}%</strong>
              </div>
              <div className="meter-track">
                <div
                  className="meter-fill"
                  style={{ width: `${Math.min(100, b.percentUsed)}%` }}
                />
              </div>
            </div>
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
            <button
              type="button"
              className="usage-breakdown-toggle"
              aria-expanded={breakdownOpen}
              aria-controls="usage-breakdown-body"
              onClick={() => setBreakdownOpen((open) => !open)}
            >
              <span>Usage breakdown</span>
              <span className="chevron" aria-hidden="true">
                ▾
              </span>
            </button>
            <div
              id="usage-breakdown-body"
              className="usage-breakdown-body"
              hidden={!breakdownOpen}
            >
              <div className="row">
                <span className="label">Included used</span>
                <span className="value">
                  {b.includedPoolUsed} / {b.planBreakdownIncluded || b.includedLimit} u
                </span>
              </div>
              <div className="row">
                <span className="label">Included remaining</span>
                <span className="value">{b.includedPoolRemaining} u</span>
              </div>
              {b.planBreakdownBonus > 0 ? (
                <div className="row">
                  <span className="label">{b.bonusLabel || "Agent credits"}</span>
                  <span className="value">
                    {b.bonusUsed} used · {b.bonusRemaining} left
                  </span>
                </div>
              ) : null}
              <div className="row">
                <span className="label">Cycle reset</span>
                <span className="value">
                  {b.resetDateLabel} ({b.daysUntilReset}d)
                </span>
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

      <SubscribeModal />
      <UsageHelpModal open={showUsageHelp} onClose={() => setShowUsageHelp(false)} />
      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} source="browser-addon-popup" />
      <Footer onFeedbackClick={() => setShowFeedback(true)} />
    </div>
  );
}
