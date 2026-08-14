import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { DashboardSnapshot } from "./cursorApi";
import { UsageMonitorService } from "./usageMonitor";

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cursorCurseMonitor.dashboard";

  constructor(
    private readonly monitor: UsageMonitorService,
    private readonly extensionUri: vscode.Uri,
    private readonly extensionVersion: string
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "media"),
      ],
    };

    const logoSvg = fs.readFileSync(
      path.join(this.extensionUri.fsPath, "media", "logo.svg"),
      "utf8"
    );
    const usageMeterSvg = fs.readFileSync(
      path.join(this.extensionUri.fsPath, "media", "usage-meter.svg"),
      "utf8"
    );

    webviewView.webview.html = this.getHtml(
      logoSvg,
      usageMeterSvg,
      webviewView.webview.cspSource,
      this.extensionVersion
    );

    const push = (snapshot: DashboardSnapshot) => {
      webviewView.webview.postMessage({ type: "snapshot", payload: snapshot });
    };

    const subscription = this.monitor.onDidUpdate(push);
    webviewView.onDidDispose(() => subscription.dispose());

    webviewView.webview.onDidReceiveMessage(async (message: { type: string; value?: number }) => {
      if (message.type === "refresh") {
        await this.monitor.refresh();
      }
      if (message.type === "setBudget" && typeof message.value === "number") {
        if (!Number.isFinite(message.value) || message.value < 0) {
          return;
        }
        await vscode.workspace
          .getConfiguration("cursorCurseMonitor")
          .update("customBudgetLimit", message.value, vscode.ConfigurationTarget.Global);
        await this.monitor.refresh();
      }
      if (message.type === "applyFallback") {
        await vscode.commands.executeCommand("cursorCurseMonitor.applyFallbackModel");
        await this.monitor.refresh();
      }
    });
  }

  private getHtml(logoSvg: string, usageMeterSvg: string, cspSource: string, extensionVersion: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <title>Usage Dashboard</title>
  <style>
    :root {
      --bg: #06080d;
      --panel: rgba(17, 24, 39, 0.6);
      --panel-2: rgba(22, 31, 46, 0.8);
      --border: rgba(148, 163, 184, 0.15);
      --text: #eef2fb;
      --muted: #8b96ad;
      --accent: #7c5cff;
      --accent-2: #5b9dff;
      --ok: #3ecf8e;
      --warn: #f5b942;
      --danger: #ff6b6b;
      --free: #7ee787;
      --neon: #39ff14;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 12px;
      line-height: 1.45;
    }
    .header {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .logo-wrap {
      flex-shrink: 0;
      width: 52px;
      height: 52px;
      border-radius: 14px;
      overflow: hidden;
      background: linear-gradient(135deg, rgba(124,92,255,.15), rgba(57,255,20,.08));
      border: 1px solid rgba(124,92,255,.35);
      box-shadow: 0 0 20px rgba(57,255,20,.12);
      --eye-color: #39ff14;
    }
    .logo-wrap svg { width: 100%; height: 100%; display: block; }
    .header-text { flex: 1; min-width: 0; }
    .header-text h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .header-text p {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 11px;
    }
    .header-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .icon-btn {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--muted);
      cursor: pointer;
      display: grid;
      place-items: center;
      font-size: 14px;
    }
    .icon-btn:hover { color: var(--text); border-color: var(--accent); }
    .connected {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      color: var(--ok);
      font-weight: 600;
    }
    .connected::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 6px var(--ok);
    }
    .section-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      margin: 0 0 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .usage-big {
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
      margin: 4px 0 2px;
    }
    .usage-sub { color: var(--muted); font-size: 11px; margin-bottom: 10px; }
    .bar {
      height: 8px;
      background: #222833;
      border-radius: 999px;
      overflow: hidden;
      position: relative;
    }
    .bar-threshold {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--warn);
      z-index: 2;
      opacity: 0.9;
    }
    .fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--accent-2), var(--accent));
      transition: width .35s ease;
    }
    .fill.warn { background: linear-gradient(90deg, var(--warn), #ff9f43); }
    .fill.danger { background: linear-gradient(90deg, var(--danger), #ff8787); }
    .fill.free { background: linear-gradient(90deg, var(--free), #56d364); }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .row .label { color: var(--muted); }
    .row .value { font-weight: 600; text-align: right; }
    .budget-value {
      font-size: 22px;
      font-weight: 700;
      margin: 4px 0;
    }
    .gauge-wrap {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .gauge {
      position: relative;
      width: 96px;
      height: 96px;
      flex-shrink: 0;
    }
    .gauge svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .gauge-track { fill: none; stroke: #252b38; stroke-width: 8; }
    .gauge-fill {
      fill: none;
      stroke: url(#gaugeGrad);
      stroke-width: 8;
      stroke-linecap: round;
      transition: stroke-dashoffset .4s ease;
    }
    .gauge-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .gauge-pct { font-size: 18px; font-weight: 700; line-height: 1; }
    .gauge-lbl { font-size: 9px; color: var(--muted); text-transform: uppercase; margin-top: 2px; }
    .gauge-stats { flex: 1; min-width: 0; }
    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
    }
    .stat-box {
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 8px 10px;
    }
    .stat-box .k { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
    .stat-box .v { font-size: 13px; font-weight: 700; margin-top: 2px; color: var(--accent-2); }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
    }
    .pill.warn { background: rgba(245,185,66,.15); color: var(--warn); }
    .pill.ok { background: rgba(62,207,142,.15); color: var(--ok); }
    .pill.danger { background: rgba(255,107,107,.15); color: var(--danger); }
    .pill.free { background: rgba(126,231,135,.15); color: var(--free); }
    .pill.accent { background: rgba(124,92,255,.15); color: #b8a0ff; }
    .features {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .feature-chip {
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 10px;
      background: rgba(124,92,255,.1);
      border: 1px solid rgba(124,92,255,.22);
      color: #c4b5fd;
    }
    .calendar-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 6px;
    }
    .cal-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(124,92,255,.15);
      display: grid;
      place-items: center;
      font-size: 16px;
    }
    .footer-msg {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 10px 12px;
      background: rgba(124,92,255,.08);
      border: 1px solid rgba(124,92,255,.18);
      border-radius: 10px;
      color: var(--muted);
      font-size: 11px;
      margin-bottom: 10px;
    }
    input, button {
      width: 100%;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #0f1319;
      color: var(--text);
      padding: 8px 10px;
      font: inherit;
    }
    button {
      cursor: pointer;
      background: var(--panel-2);
      margin-top: 6px;
    }
    button.primary {
      background: linear-gradient(90deg, #5b4cff, var(--accent));
      border-color: transparent;
      color: #fff;
      font-weight: 600;
    }
    button.ghost {
      background: transparent;
    }
    .actions { display: grid; gap: 6px; }
    .error {
      color: var(--danger);
      white-space: pre-wrap;
      font-size: 11px;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .edit-link {
      color: var(--accent-2);
      font-size: 11px;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
      width: auto;
      margin: 0;
    }
    .budget-edit { display: none; margin-top: 8px; }
    .budget-edit.open { display: block; }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-top: 10px;
      font-size: 11px;
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
    }
    .footer-left a {
      color: var(--accent-2);
      text-decoration: none;
      font-weight: 600;
    }
    .footer-left a:hover {
      text-decoration: underline;
    }
    .footer-right {
      color: var(--muted);
      font-weight: 600;
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo-wrap" id="mascotLogo">
      ${logoSvg}
    </div>
    <div class="header-text">
      <h1>Usage Dashboard</h1>
      <p id="subtitle">Monitor your API usage and manage your budget.</p>
      <span class="connected" id="connBadge">Connected</span>
    </div>
    <div class="header-actions">
      <button class="icon-btn" id="refreshBtn" title="Refresh">↻</button>
    </div>
  </header>

  <div id="errorBox" class="card error" style="display:none"></div>

  <section class="card" id="usageCard">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <p class="section-label" style="margin:0;">
        <span style="display:inline-block; width:16px; height:16px; margin-right:4px; vertical-align:middle;">${usageMeterSvg}</span>
        Usage 
      </p>
      <span id="statusPill" class="pill ok">OK</span>
    </div>
    <div class="usage-big" id="usageBig">—%</div>
    <div class="usage-sub" id="usageSub">of included quota</div>
    <div class="bar">
      <div class="bar-threshold" id="thresholdLine" style="left:80%"></div>
      <div class="fill" id="usageBar"></div>
    </div>
    <div class="row">
      <span class="label" id="usedLabel">Used</span>
      <span class="value" id="usedValue">—</span>
    </div>
    <div class="row">
      <span class="label" id="capLabel">Limit</span>
      <span class="value" id="capValue">—</span>
    </div>
  </section>

  <section class="card" id="budgetTrackerCard">
    <p class="section-label">Budget Tracker</p>
    <div class="gauge-wrap">
      <div class="gauge">
        <svg viewBox="0 0 100 100">
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#5b9dff"/>
              <stop offset="100%" stop-color="#f5b942"/>
            </linearGradient>
          </defs>
          <circle class="gauge-track" cx="50" cy="50" r="42"/>
          <circle class="gauge-fill" id="gaugeArc" cx="50" cy="50" r="42"
            stroke-dasharray="263.89" stroke-dashoffset="263.89"/>
        </svg>
        <div class="gauge-center">
          <div class="gauge-pct" id="gaugePct">0%</div>
          <div class="gauge-lbl">current</div>
        </div>
      </div>
      <div class="gauge-stats">
        <div id="thresholdPill" class="pill warn" style="display:none">⚠ threshold</div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="k">Budget cap</div>
            <div class="v" id="budgetCapVal">—</div>
          </div>
          <div class="stat-box">
            <div class="k">Amount left</div>
            <div class="v" id="amountLeftVal">—</div>
          </div>
          <div class="stat-box">
            <div class="k">On-demand</div>
            <div class="v" id="onDemandVal">—</div>
          </div>
          <div class="stat-box">
            <div class="k">Remaining units</div>
            <div class="v" id="unitsLeftVal">—</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="card">
    <p class="section-label">Budget cap</p>
    <div class="row" style="margin-top:0">
      <div>
        <div class="budget-value" id="budgetCapBig">$0.00</div>
        <div class="usage-sub">USD · optional personal limit</div>
      </div>
      <button class="edit-link" id="editBudgetBtn">Edit cap</button>
    </div>
    <div class="budget-edit" id="budgetEdit">
      <input id="budgetInput" type="number" min="0" step="1" placeholder="0 = plan included only" />
      <button class="primary" id="saveBudgetBtn">Save budget cap</button>
    </div>
  </section>

  <section class="card">
    <p class="section-label">Billing reset</p>
    <div class="calendar-row">
      <div class="cal-icon">📅</div>
      <div>
        <div class="value" id="resetText">Resets on —</div>
        <div class="usage-sub" id="cycleRange">—</div>
      </div>
      <span class="pill accent" id="daysPill">—</span>
    </div>
    <div class="row">
      <span class="label">Plan</span>
      <span class="value" id="planText">—</span>
    </div>
    <div class="row">
      <span class="label">Limit type</span>
      <span class="value" id="limitTypeText">—</span>
    </div>
  </section>

  <section class="card">
    <p class="section-label">API features</p>
    <div class="features" id="featureChips"></div>
    <div class="row" style="margin-top:10px">
      <span class="label">Fallback model</span>
      <span class="value mono">composer-2.5 · fast: false</span>
    </div>
    <div class="row">
      <span class="label">Auto-switched</span>
      <span class="value" id="autoSwitchText">No</span>
    </div>
  </section>

  <div class="footer-msg">
    <span>🛡️</span>
    <span id="footerMsg">You're in control. We'll notify you before you reach your cap.</span>
  </div>

  <div class="actions">
    <button class="primary" id="refreshBtn2">Refresh now</button>
    <button class="ghost" id="fallbackBtn">Apply free fallback model</button>
  </div>

  <footer class="footer">
    <div class="footer-left">
      <span>A product of</span>
      <a href="https://lorapok.tech" target="_blank">Lorapok Labs</a>
    </div>
    <div class="footer-right">
      v${extensionVersion}
    </div>
  </footer>

  <script>
    const vscode = acquireVsCodeApi();
    const CIRC = 263.89;

    function money(n) {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n || 0);
    }

    function setGauge(pct) {
      const arc = document.getElementById('gaugeArc');
      const offset = CIRC - (Math.min(100, pct) / 100) * CIRC;
      arc.style.strokeDashoffset = String(offset);
      document.getElementById('gaugePct').textContent = Math.round(pct) + '%';
    }

    function escHtml(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function render(snapshot) {
      const b = snapshot.budget;
      const usage = snapshot.usage;
      const errorBox = document.getElementById('errorBox');

      document.getElementById('subtitle').textContent = (snapshot.email ? snapshot.email + ' · ' : '') +
        'Lorapok Labs · ' + new Date(snapshot.fetchedAt).toLocaleTimeString();

      if (snapshot.error) {
        errorBox.style.display = 'block';
        errorBox.textContent = snapshot.error;
        document.getElementById('connBadge').style.display = 'none';
        return;
      }
      errorBox.style.display = 'none';
      document.getElementById('connBadge').style.display = 'inline-flex';

      if (!usage || !b) return;

      const pct = b.percentUsed;
      const statusPill = document.getElementById('statusPill');
      const usageBar = document.getElementById('usageBar');
      const thresholdLine = document.getElementById('thresholdLine');

      thresholdLine.style.left = b.thresholdPercent + '%';

      document.getElementById('usageBig').textContent = Math.round(pct) + '%';
      document.getElementById('usageSub').textContent = b.hasUsdBudget
        ? 'of budget used'
        : 'of included quota used';

      usageBar.style.width = Math.min(100, pct) + '%';
      usageBar.className = 'fill' + (
        snapshot.limitExceeded ? ' free' :
        pct >= 100 ? ' danger' :
        pct >= b.thresholdPercent ? ' warn' : ''
      );

      if (snapshot.limitExceeded) {
        statusPill.className = 'pill free';
        statusPill.textContent = 'FREE FALLBACK';
      } else if (pct >= b.thresholdPercent) {
        statusPill.className = 'pill warn';
        statusPill.textContent = 'WARNING';
      } else {
        statusPill.className = 'pill ok';
        statusPill.textContent = 'OK';
      }

      if (b.hasUsdBudget) {
        document.getElementById('usedLabel').textContent = 'Spent';
        document.getElementById('usedValue').textContent = money(b.spentUsd);
        document.getElementById('capLabel').textContent = 'Budget';
        document.getElementById('capValue').textContent = money(b.capUsd);
      } else {
        document.getElementById('usedLabel').textContent = 'Included used';
        document.getElementById('usedValue').textContent = b.includedUsed + ' / ' + b.includedLimit + ' units';
        document.getElementById('capLabel').textContent = 'Remaining';
        document.getElementById('capValue').textContent = b.includedRemaining + ' units';
      }

      setGauge(pct);
      document.getElementById('budgetCapVal').textContent = b.hasUsdBudget ? money(b.capUsd) : b.includedLimit + ' u';
      document.getElementById('amountLeftVal').textContent = b.hasUsdBudget ? money(b.leftUsd) : b.includedRemaining + ' u';
      document.getElementById('onDemandVal').textContent = b.onDemandEnabled
        ? money(snapshot.onDemandSpendUsd) + (b.onDemandCapUsd ? ' / ' + money(b.onDemandCapUsd) : '')
        : 'Off';
      document.getElementById('unitsLeftVal').textContent = b.includedRemaining + ' u';

      const thresholdPill = document.getElementById('thresholdPill');
      thresholdPill.style.display = b.thresholdReached ? 'inline-block' : 'none';
      thresholdPill.textContent = '⚠ ' + b.thresholdPercent + '% threshold';

      document.getElementById('budgetCapBig').textContent = money(snapshot.customBudgetLimit || 0);
      document.getElementById('budgetInput').value = snapshot.customBudgetLimit || '';

      document.getElementById('resetText').textContent = 'Resets on ' + b.resetDateLabel;
      document.getElementById('cycleRange').textContent = b.cycleStartLabel + ' → ' + b.cycleEndLabel;
      document.getElementById('daysPill').textContent = 'in ' + b.daysUntilReset + ' days';

      const profile = snapshot.profile;
      document.getElementById('planText').textContent =
        (profile?.membershipType || usage.membershipType || '-') +
        (profile?.isTeamMember ? ' (team)' : '');
      document.getElementById('limitTypeText').textContent = usage.limitType;

      document.getElementById('autoSwitchText').textContent = snapshot.limitExceeded
        ? (snapshot.fallbackApplied ? 'Yes · Composer 2.5' : 'Pending')
        : 'No';

      const chips = document.getElementById('featureChips');
      chips.innerHTML = (snapshot.features || []).map(function(f) {
        return '<span class="feature-chip">' + escHtml(f) + '</span>';
      }).join('');

      document.getElementById('footerMsg').textContent = b.thresholdReached
        ? 'Usage is at ' + Math.round(pct) + '%. Consider Composer 2.5 (Fast off) before hitting the cap.'
        : "You're in control. We'll notify you before you reach your cap.";

      var mascot = document.getElementById('mascotLogo');
      if (mascot) {
        var eyeColor = '#39ff14';
        if (snapshot.limitExceeded) eyeColor = '#7ee787';
        else if (pct >= 100) eyeColor = '#ff6b6b';
        else if (pct >= b.thresholdPercent) eyeColor = '#f5b942';
        else if (pct >= 50) eyeColor = '#5b9dff';
        mascot.style.setProperty('--eye-color', eyeColor);
      }
    }

    window.addEventListener('message', function(event) {
      if (event.data?.type === 'snapshot') render(event.data.payload);
    });

    function refresh() { vscode.postMessage({ type: 'refresh' }); }
    document.getElementById('refreshBtn').addEventListener('click', refresh);
    document.getElementById('refreshBtn2').addEventListener('click', refresh);
    document.getElementById('fallbackBtn').addEventListener('click', function() {
      vscode.postMessage({ type: 'applyFallback' });
    });
    document.getElementById('editBudgetBtn').addEventListener('click', function() {
      document.getElementById('budgetEdit').classList.toggle('open');
    });
    document.getElementById('saveBudgetBtn').addEventListener('click', function() {
      var value = Number(document.getElementById('budgetInput').value || 0);
      if (!Number.isFinite(value) || value < 0) return;
      vscode.postMessage({ type: 'setBudget', value: value });
      document.getElementById('budgetEdit').classList.remove('open');
    });
  </script>
</body>
</html>`;
  }
}

export type StatusBarUsageSource = "plan" | "autoApi" | "both";

function formatFeaturePercent(n: number): string {
  if (!Number.isFinite(n)) {
    return "0";
  }
  return String(Math.round(n * 100) / 100);
}

function planPercent(snapshot: DashboardSnapshot): number {
  return snapshot.budget?.percentUsed
    ?? snapshot.usage?.individualUsage.plan.totalPercentUsed
    ?? 0;
}

function autoApiPercents(snapshot: DashboardSnapshot): { auto: number; api: number } {
  const plan = snapshot.usage?.individualUsage.plan;
  return {
    auto: snapshot.budget?.autoPercentUsed ?? plan?.autoPercentUsed ?? 0,
    api: snapshot.budget?.apiPercentUsed ?? plan?.apiPercentUsed ?? 0,
  };
}

function statusBarIcon(snapshot: DashboardSnapshot, warnPercent: number): string {
  if (snapshot.error) {
    return "$(warning)";
  }
  if (snapshot.limitExceeded) {
    return "$(pass)";
  }
  if (warnPercent >= (snapshot.budget?.thresholdPercent ?? 80)) {
    return "$(warning)";
  }
  return "$(graph)";
}

function formatPlanUsage(snapshot: DashboardSnapshot): string {
  const pct = Math.round(planPercent(snapshot));
  const b = snapshot.budget;
  if (snapshot.limitExceeded) {
    return `Usage: ${pct}% (free)`;
  }
  if (b?.hasUsdBudget) {
    return `Usage: ${pct}% (${money(b.spentUsd)} / ${money(b.capUsd)})`;
  }
  return `Usage: ${pct}%`;
}

function formatAutoApiUsage(snapshot: DashboardSnapshot): string {
  const { auto, api } = autoApiPercents(snapshot);
  const suffix = snapshot.limitExceeded ? " (free)" : "";
  return `Auto ${formatFeaturePercent(auto)}% · API ${formatFeaturePercent(api)}%${suffix}`;
}

export function formatStatusBarText(
  snapshot: DashboardSnapshot,
  source: StatusBarUsageSource = "plan"
): string {
  if (snapshot.error) {
    return "$(warning) Cursor usage";
  }
  const { auto, api } = autoApiPercents(snapshot);
  const warnPercent =
    source === "plan"
      ? planPercent(snapshot)
      : Math.max(auto, api, source === "both" ? planPercent(snapshot) : 0);
  const icon = statusBarIcon(snapshot, warnPercent);

  if (source === "autoApi") {
    return `${icon} ${formatAutoApiUsage(snapshot)}`;
  }
  if (source === "both") {
    return `${icon} ${formatPlanUsage(snapshot)} · ${formatAutoApiUsage(snapshot)}`;
  }
  return `${icon} ${formatPlanUsage(snapshot)}`;
}

export function formatStatusBarTooltip(snapshot: DashboardSnapshot): string {
  if (snapshot.error) {
    return snapshot.error;
  }
  const { auto, api } = autoApiPercents(snapshot);
  const planPct = planPercent(snapshot);
  const lines = [
    `Plan: ${Math.round(planPct)}%`,
    `Auto: ${formatFeaturePercent(auto)}%`,
    `API: ${formatFeaturePercent(api)}%`,
  ];
  const b = snapshot.budget;
  if (b?.hasUsdBudget) {
    lines.push(`${b.spentUsd.toFixed(2)} / ${b.capUsd.toFixed(2)} USD`);
  }
  return lines.join("\n");
}

function money(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n || 0);
}
