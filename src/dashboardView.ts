import * as vscode from "vscode";
import { DashboardSnapshot } from "./cursorApi";
import { UsageMonitorService } from "./usageMonitor";

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cursorCurseMonitor.dashboard";

  constructor(private readonly monitor: UsageMonitorService) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };

    webviewView.webview.html = this.getHtml();

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
        await vscode.workspace
          .getConfiguration("cursorCurseMonitor")
          .update("customBudgetLimit", message.value, vscode.ConfigurationTarget.Global);
        await this.monitor.refresh();
      }
      if (message.type === "applyFallback") {
        await vscode.commands.executeCommand(
          "cursorCurseMonitor.applyFallbackModel"
        );
        await this.monitor.refresh();
      }
    });
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cursor Curse Monitor</title>
  <style>
    :root {
      --bg: #111418;
      --panel: #171b22;
      --border: #2a3140;
      --text: #e8edf7;
      --muted: #9aa7bd;
      --accent: #5b9dff;
      --ok: #3ecf8e;
      --warn: #f5c451;
      --danger: #ff6b6b;
      --free: #7ee787;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 14px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      line-height: 1.45;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 650;
    }
    .sub { color: var(--muted); margin-bottom: 14px; }
    .grid { display: grid; gap: 10px; }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
    }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .label { color: var(--muted); }
    .value { font-weight: 600; text-align: right; }
    .bar {
      height: 8px;
      background: #222833;
      border-radius: 999px;
      overflow: hidden;
      margin-top: 8px;
    }
    .fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--accent), #7c5cff);
      transition: width .3s ease;
    }
    .fill.warn { background: linear-gradient(90deg, var(--warn), #ff9f43); }
    .fill.danger { background: linear-gradient(90deg, var(--danger), #ff8787); }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge.ok { background: rgba(62,207,142,.15); color: var(--ok); }
    .badge.warn { background: rgba(245,196,81,.15); color: var(--warn); }
    .badge.danger { background: rgba(255,107,107,.15); color: var(--danger); }
    .badge.free { background: rgba(126,231,135,.15); color: var(--free); }
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
      background: #1a2330;
      margin-top: 8px;
    }
    button.primary {
      background: linear-gradient(90deg, #3d74ff, #6a55ff);
      border-color: transparent;
    }
    .actions { display: grid; gap: 8px; margin-top: 10px; }
    .error {
      color: var(--danger);
      white-space: pre-wrap;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Cursor Curse Monitor</h1>
  <div class="sub" id="subtitle">by Lorapok Labs · Loading...</div>

  <div class="grid">
    <div class="card">
      <div class="row"><span class="label">Status</span><span id="statusBadge" class="badge ok">OK</span></div>
      <div class="row" style="margin-top:8px"><span class="label">Included usage</span><span class="value" id="usageText">-</span></div>
      <div class="bar"><div class="fill" id="usageBar"></div></div>
      <div class="row" style="margin-top:8px"><span class="label">Remaining</span><span class="value" id="remainingText">-</span></div>
    </div>

    <div class="card">
      <div class="row"><span class="label">Billing cycle</span><span class="value" id="cycleText">-</span></div>
      <div class="row" style="margin-top:8px"><span class="label">Resets in</span><span class="value" id="daysLeftText">-</span></div>
      <div class="row" style="margin-top:8px"><span class="label">Plan</span><span class="value" id="planText">-</span></div>
      <div class="row" style="margin-top:8px"><span class="label">Limit type</span><span class="value" id="limitTypeText">-</span></div>
    </div>

    <div class="card">
      <div class="row"><span class="label">On-demand</span><span class="value" id="onDemandText">-</span></div>
      <div class="row" style="margin-top:8px"><span class="label">On-demand used</span><span class="value" id="onDemandUsedText">-</span></div>
      <div class="row" style="margin-top:8px"><span class="label">Fallback model</span><span class="value mono" id="fallbackText">composer-2.5 (fast: false)</span></div>
      <div class="row" style="margin-top:8px"><span class="label">Auto-switched</span><span class="value" id="autoSwitchText">-</span></div>
    </div>

    <div class="card">
      <div class="row"><span class="label">Privacy</span><span class="value">Your login only</span></div>
      <div class="row" style="margin-top:8px"><span class="label">Team members</span><span class="value">Not visible here</span></div>
    </div>

    <div class="card">
      <label class="label" for="budgetInput">Custom budget cap (USD, optional)</label>
      <input id="budgetInput" type="number" min="0" step="1" placeholder="0 = use included plan only" />
      <div class="actions">
        <button id="saveBudgetBtn">Save budget</button>
        <button class="primary" id="refreshBtn">Refresh now</button>
        <button id="fallbackBtn">Apply free fallback model</button>
      </div>
    </div>

    <div class="card error" id="errorBox" style="display:none"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function money(n) {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n || 0);
    }

    function render(snapshot) {
      const subtitle = document.getElementById('subtitle');
      const errorBox = document.getElementById('errorBox');
      const statusBadge = document.getElementById('statusBadge');
      const usageBar = document.getElementById('usageBar');
      const usageText = document.getElementById('usageText');
      const remainingText = document.getElementById('remainingText');
      const cycleText = document.getElementById('cycleText');
      const daysLeftText = document.getElementById('daysLeftText');
      const planText = document.getElementById('planText');
      const limitTypeText = document.getElementById('limitTypeText');
      const onDemandText = document.getElementById('onDemandText');
      const onDemandUsedText = document.getElementById('onDemandUsedText');
      const autoSwitchText = document.getElementById('autoSwitchText');
      const budgetInput = document.getElementById('budgetInput');

      subtitle.textContent = (snapshot.email
        ? snapshot.email + ' · '
        : '') + 'Lorapok Labs · updated ' + new Date(snapshot.fetchedAt).toLocaleTimeString();

      if (snapshot.error) {
        errorBox.style.display = 'block';
        errorBox.textContent = snapshot.error;
      } else {
        errorBox.style.display = 'none';
        errorBox.textContent = '';
      }

      const usage = snapshot.usage;
      if (!usage) return;

      const plan = usage.individualUsage.plan;
      const percent = plan.totalPercentUsed || 0;
      usageText.textContent = percent + '% (' + plan.used + ' / ' + plan.limit + ')';
      remainingText.textContent = plan.remaining + ' units';
      usageBar.style.width = Math.min(100, percent) + '%';
      usageBar.className = 'fill' + (percent >= 100 ? ' danger' : percent >= 80 ? ' warn' : '');

      cycleText.textContent = new Date(usage.billingCycleStart).toLocaleDateString() + ' → ' + new Date(usage.billingCycleEnd).toLocaleDateString();
      const days = Math.max(0, Math.ceil((new Date(usage.billingCycleEnd) - Date.now()) / 86400000));
      daysLeftText.textContent = days + ' days';
      planText.textContent = (snapshot.profile?.membershipType || usage.membershipType || '-') + (snapshot.profile?.isTeamMember ? ' (team)' : '');
      limitTypeText.textContent = usage.limitType;

      const onDemand = usage.individualUsage.onDemand;
      onDemandText.textContent = onDemand.enabled ? 'Enabled' : 'Disabled';
      onDemandUsedText.textContent = money(snapshot.onDemandSpendUsd);

      if (snapshot.customBudgetLimit > 0) {
        remainingText.textContent += ' · budget cap ' + money(snapshot.customBudgetLimit);
      }

      if (snapshot.limitExceeded) {
        statusBadge.className = 'badge free';
        statusBadge.textContent = 'FREE FALLBACK';
        autoSwitchText.textContent = snapshot.fallbackApplied ? 'Yes (Composer 2.5, Fast off)' : 'Pending / manual';
      } else if (percent >= 80) {
        statusBadge.className = 'badge warn';
        statusBadge.textContent = 'WARNING';
        autoSwitchText.textContent = 'No';
      } else {
        statusBadge.className = 'badge ok';
        statusBadge.textContent = 'OK';
        autoSwitchText.textContent = 'No';
      }

      budgetInput.value = snapshot.customBudgetLimit || '';
    }

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'snapshot') {
        render(event.data.payload);
      }
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });
    document.getElementById('fallbackBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'applyFallback' });
    });
    document.getElementById('saveBudgetBtn').addEventListener('click', () => {
      const value = Number(document.getElementById('budgetInput').value || 0);
      vscode.postMessage({ type: 'setBudget', value });
    });
  </script>
</body>
</html>`;
  }
}

export function formatStatusBarText(snapshot: DashboardSnapshot): string {
  if (snapshot.error) {
    return "$(warning) Cursor usage";
  }
  const percent = snapshot.usage?.individualUsage.plan.totalPercentUsed ?? 0;
  if (snapshot.limitExceeded) {
    return `$(pass) Cursor ${percent}% (free)`;
  }
  if (percent >= 80) {
    return `$(warning) Cursor ${percent}%`;
  }
  return `$(graph) Cursor ${percent}%`;
}
