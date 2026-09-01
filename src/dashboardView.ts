import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { DashboardSnapshot, DISCORD_INVITE_URL, formatPercent, SUPPORT_EMAIL } from "./cursorApi";
import { UsageMonitorService } from "./usageMonitor";
import { generateNonce } from "./utils";
import { subscribeForProductUpdates, getSubscribePromptViewState, snoozeSubscribePrompt, declineSubscribePrompt } from "./updateSubscription";
import {
  SUPPORTED_IDE_WRAPPERS,
  SUPPORTED_IDE_WRAPPERS_HEADLINE,
  SUPPORTED_IDE_WRAPPERS_SUBLINE,
} from "@lorapok/cursor-monitor-shared";
import { fetchCommunityDownloadStats } from "./communityDownloads";
import {
  readEditorSettings,
  serializeEditorSettings,
  updateEditorSettings,
  type EditorSettings,
} from "./editorSettings";
import { scanMonitoringDbBackups, type DbBackupScanResult } from "./cursorAuth";
import { reindexMissingConversations } from "./conversationReindex";
import { resolveReindexPolicy } from "./reindexConfig";
import { notifyReindexResult } from "./reindexUi";

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cursorCurseMonitor.dashboard";

  private logoSvgCache: string | null = null;
  private usageMeterSvgCache: string | null = null;

  constructor(
    private readonly monitor: UsageMonitorService,
    private readonly extensionUri: vscode.Uri,
    private readonly extensionVersion: string,
    private readonly extensionContext: vscode.ExtensionContext
  ) {}

  private getMediaSvg(filename: string): string {
    const filePath = path.join(this.extensionUri.fsPath, "media", filename);
    try {
      return fs.readFileSync(filePath, "utf8");
    } catch {
      return "";
    }
  }

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

    if (!this.logoSvgCache) {
      this.logoSvgCache = this.getMediaSvg("logo.svg");
    }
    if (!this.usageMeterSvgCache) {
      this.usageMeterSvgCache = this.getMediaSvg("usage-meter.svg");
    }

    const nonce = generateNonce();
    const iconUri = webviewView.webview
      .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "icon.png"))
      .toString();

    let viewReady = false;
    let latestSnapshot = this.monitor.getSnapshot();

    const push = (snapshot: DashboardSnapshot) => {
      latestSnapshot = snapshot;
      if (!viewReady) {
        return;
      }
      void webviewView.webview.postMessage({ type: "snapshot", payload: snapshot });
    };

    const pushCommunityStats = async () => {
      const stats = await fetchCommunityDownloadStats();
      if (stats) {
        webviewView.webview.postMessage({ type: "communityDownloads", payload: stats });
      }
    };

    const pushBackupStats = () => {
      if (!viewReady) {
        return;
      }
      const payload: DbBackupScanResult = scanMonitoringDbBackups();
      webviewView.webview.postMessage({ type: "dbBackupStats", payload });
    };

    const pushReindexPolicy = async () => {
      const policy = await resolveReindexPolicy();
      if (!viewReady) return;
      webviewView.webview.postMessage({ type: "reindexPolicy", payload: policy });
    };

    const deliverSnapshot = async (force = false) => {
      if (latestSnapshot) {
        push(latestSnapshot);
      }
      const cached = this.monitor.getSnapshot();
      if (cached) {
        push(cached);
      }

      const refreshWithTimeout = async (): Promise<DashboardSnapshot | undefined> => {
        const timeoutMs = 20_000;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            this.monitor.refresh(force),
            new Promise<undefined>((resolve) => {
              timer = setTimeout(() => resolve(undefined), timeoutMs);
            }),
          ]);
        } finally {
          if (timer) {
            clearTimeout(timer);
          }
        }
      };

      try {
        const fresh = await refreshWithTimeout();
        if (fresh) {
          push(fresh);
        } else {
          const fallback = this.monitor.getSnapshot();
          if (fallback) {
            push(fallback);
          }
        }
      } catch {
        const fallback = this.monitor.getSnapshot();
        if (fallback) {
          push(fallback);
        }
      }
      void pushCommunityStats();
      pushBackupStats();
      void pushReindexPolicy();
    };

    const subscription = this.monitor.onDidUpdate(push);
    const readyFallback = setTimeout(() => {
      if (viewReady) {
        return;
      }
      viewReady = true;
      void deliverSnapshot(false);
    }, 2000);

    webviewView.onDidDispose(() => {
      clearTimeout(readyFallback);
      subscription.dispose();
    });

    webviewView.onDidChangeVisibility(() => {
      if (!webviewView.visible || !viewReady) {
        return;
      }
      if (latestSnapshot) {
        push(latestSnapshot);
      }
    });

    // Register the message handler before assigning html — on Windows, macOS, and
    // Linux the inline script can post `ready` synchronously when html is set.
    webviewView.webview.onDidReceiveMessage(async (message: {
      type: string;
      value?: number;
      email?: string;
      accountId?: string;
      settings?: Partial<EditorSettings>;
    }) => {
      if (message.type === "ready") {
        if (viewReady) {
          return;
        }
        viewReady = true;
        void deliverSnapshot(false);
        return;
      }
      if (message.type === "refresh") {
        void deliverSnapshot(false);
        return;
      }
      if (message.type === "setBudget" && typeof message.value === "number") {
        if (!Number.isFinite(message.value) || message.value < 0 || message.value > 100000) {
          return;
        }
        await vscode.workspace
          .getConfiguration("cursorCurseMonitor")
          .update("customBudgetLimit", message.value, vscode.ConfigurationTarget.Global);
        await deliverSnapshot(true);
        return;
      }
      if (message.type === "applyFallback") {
        await vscode.commands.executeCommand("cursorCurseMonitor.applyFallbackModel");
        await deliverSnapshot(true);
        return;
      }
      if (message.type === "sendFeedback") {
        await vscode.commands.executeCommand("cursorCurseMonitor.sendFeedback");
        return;
      }
      if (message.type === "reindexConversations") {
        webviewView.webview.postMessage({
          type: "reindexProgress",
          payload: { phase: "preparing", message: "Starting conversation reindex…" },
        });
        const policy = await resolveReindexPolicy(true);
        const result = await reindexMissingConversations(this.extensionUri, {
          policy,
          onProgress: (update) => {
            webviewView.webview.postMessage({ type: "reindexProgress", payload: update });
          },
        });
        webviewView.webview.postMessage({ type: "reindexResult", payload: result });
        notifyReindexResult(result, policy);
        return;
      }
      if (message.type === "recoverDbBackups") {
        await vscode.commands.executeCommand("cursorCurseMonitor.recoverDbBackups");
        pushBackupStats();
      }
      if (message.type === "switchAccount" && typeof message.accountId === "string") {
        await vscode.commands.executeCommand("cursorCurseMonitor.switchAccount", message.accountId);
        void deliverSnapshot(true);
        return;
      }
      if (message.type === "addAccount") {
        await vscode.commands.executeCommand("cursorCurseMonitor.addAccount");
        return;
      }
      if (message.type === "loginWithBrowser") {
        await vscode.commands.executeCommand("cursorCurseMonitor.loginWithBrowser");
        return;
      }
      if (message.type === "pasteToken") {
        await vscode.commands.executeCommand("cursorCurseMonitor.pasteToken");
        return;
      }
      if (message.type === "removeAccount") {
        await vscode.commands.executeCommand(
          "cursorCurseMonitor.removeAccount",
          typeof message.accountId === "string" ? message.accountId : undefined
        );
        return;
      }
      if (message.type === "subscribeUpdates" && typeof message.email === "string") {
        const result = await subscribeForProductUpdates(
          this.extensionContext,
          message.email,
          "extension-dashboard"
        );
        const state = await getSubscribePromptViewState(this.extensionContext);
        webviewView.webview.postMessage({
          type: "subscribeResult",
          payload: { ...result, state },
        });
      }
      if (message.type === "snoozeSubscribe") {
        await snoozeSubscribePrompt(this.extensionContext);
        const state = await getSubscribePromptViewState(this.extensionContext);
        webviewView.webview.postMessage({ type: "subscribeState", payload: state });
      }
      if (message.type === "declineSubscribe") {
        await declineSubscribePrompt(this.extensionContext);
        const state = await getSubscribePromptViewState(this.extensionContext);
        webviewView.webview.postMessage({ type: "subscribeState", payload: state });
      }
      if (message.type === "getEditorSettings") {
        webviewView.webview.postMessage({
          type: "editorSettings",
          payload: readEditorSettings(),
        });
        return;
      }
      if (message.type === "updateEditorSettings" && message.settings) {
        const next = await updateEditorSettings(message.settings);
        webviewView.webview.postMessage({ type: "editorSettings", payload: next });
        await deliverSnapshot(true);
        return;
      }
      if (message.type === "getSubscribeState") {
        const state = await getSubscribePromptViewState(this.extensionContext);
        webviewView.webview.postMessage({ type: "subscribeState", payload: state });
      }
    });

    viewReady = false;
    webviewView.webview.html = this.getHtml(
      this.logoSvgCache,
      this.usageMeterSvgCache,
      webviewView.webview.cspSource,
      this.extensionVersion,
      nonce,
      iconUri,
      serializeWebviewBootSnapshot(latestSnapshot),
      serializeEditorSettings(readEditorSettings())
    );
  }

  private getHtml(
    logoSvg: string,
    usageMeterSvg: string,
    cspSource: string,
    extensionVersion: string,
    nonce: string,
    iconUri: string,
    bootJson: string,
    bootSettingsJson: string
  ): string {
    const esc = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const supportedIdeNames = SUPPORTED_IDE_WRAPPERS.map((ide) => esc(ide.name)).join(", ");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <title>Usage Dashboard</title>
  <style>
    :root {
      --bg: #07090f;
      --panel: rgba(16, 22, 34, 0.78);
      --panel-2: rgba(22, 30, 44, 0.92);
      --border: rgba(148, 163, 184, 0.14);
      --text: #eef2fb;
      --muted: #8b96ad;
      --accent: #7c5cff;
      --accent-2: #5b9dff;
      --ok: #3ecf8e;
      --warn: #f5b942;
      --danger: #ff6b6b;
      --free: #7ee787;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      padding: 14px 12px 16px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      background:
        radial-gradient(1200px 400px at -10% -20%, rgba(91,157,255,.16), transparent 50%),
        radial-gradient(900px 360px at 120% 0%, rgba(124,92,255,.14), transparent 46%),
        var(--bg);
      color: var(--text);
      font-size: 12px;
      line-height: 1.45;
    }
    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      margin: 0 0 12px;
      padding: 14px 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background:
        linear-gradient(135deg, rgba(124,92,255,.08), rgba(91,157,255,.04)),
        var(--panel);
      color: var(--muted);
      font: inherit;
      font-size: 12px;
      letter-spacing: 0.02em;
      cursor: default;
    }
    .loading-state .spinner {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid rgba(124,92,255,.22);
      border-top-color: var(--accent);
      animation: ccm-spin 0.85s linear infinite;
      flex-shrink: 0;
    }
    @keyframes ccm-spin {
      to { transform: rotate(360deg); }
    }
    .loading-state:not(:disabled) {
      cursor: pointer;
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
      width: 48px;
      height: 48px;
      border-radius: 14px;
      overflow: hidden;
      background: linear-gradient(135deg, rgba(124,92,255,.18), rgba(91,157,255,.1));
      border: 1px solid rgba(124,92,255,.32);
      box-shadow: 0 0 22px rgba(91,157,255,.12);
      --eye-color: #39ff14;
    }
    .logo-wrap svg { width: 100%; height: 100%; display: block; }
    .header-text { flex: 1; min-width: 0; }
    .header-text h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.03em;
      background: linear-gradient(90deg, #8ec5ff, #c4b5fd);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .header-text p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-status-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      margin-top: 8px;
    }
    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.03);
      color: var(--muted);
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status-chip::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--muted);
    }
    .status-chip.ok {
      color: var(--ok);
      border-color: rgba(57,255,20,.22);
      background: rgba(57,255,20,.06);
    }
    .status-chip.ok::before {
      background: var(--ok);
      box-shadow: 0 0 6px var(--ok);
    }
    .status-chip.warn {
      color: var(--warn);
      border-color: rgba(255,196,77,.24);
      background: rgba(255,196,77,.08);
    }
    .status-chip.warn::before {
      background: var(--warn);
    }
    .status-chip.accent {
      color: var(--accent-2);
      border-color: rgba(91,157,255,.28);
      background: rgba(91,157,255,.08);
    }
    .status-chip.accent::before {
      background: var(--accent-2);
    }
    .connect-banner {
      display: none;
      margin: 0 0 12px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,196,77,.28);
      background: linear-gradient(135deg, rgba(255,196,77,.1), rgba(124,92,255,.08));
      font-size: 11px;
      line-height: 1.5;
      color: var(--text);
    }
    .connect-banner.visible { display: block; }
    .connect-banner strong { color: var(--warn); }
    .header-actions { display: flex; gap: 6px; align-items: center; }
    .account-switcher {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    .account-switcher-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      flex: 0 0 auto;
    }
    .account-switcher-hint {
      flex: 1 1 100%;
      margin: 0;
      font-size: 10px;
      line-height: 1.4;
    }
    .account-switcher select {
      max-width: 220px;
      min-width: 0;
      flex: 1;
      height: 28px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--text);
      font: inherit;
      font-size: 11px;
      padding: 0 8px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
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
    .icon-btn:disabled { opacity: 0.4; cursor: default; }
    .icon-btn:focus-visible,
    button:focus-visible,
    a:focus-visible,
    input:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--accent-2);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .fill, .meter-fill, .logo-wrap { transition: none !important; }
      .subscribe-btn-loading::after { animation: none !important; }
      .section-toggle .chevron { transition: none; }
      .collapsible-body { animation: none; }
    }
    .connected {
      display: none;
    }
    .section-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      margin: 0 0 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,.18);
    }
    .usage-big {
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.04em;
      margin: 2px 0 4px;
    }
    .usage-sub { color: var(--muted); font-size: 11px; margin-bottom: 12px; }
    .bar, .meter-track {
      height: 8px;
      background: #1b2230;
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
    .fill, .meter-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--accent-2), var(--accent));
      transition: width .35s ease;
      border-radius: 999px;
    }
    .fill.warn, .meter-fill.warn { background: linear-gradient(90deg, var(--warn), #ff9f43); }
    .fill.danger, .meter-fill.danger { background: linear-gradient(90deg, var(--danger), #ff8787); }
    .fill.free, .meter-fill.free { background: linear-gradient(90deg, var(--free), #56d364); }
    .dual-meters { display: grid; gap: 10px; margin-top: 14px; }
    .meter-row { display: grid; gap: 5px; }
    .meter-head { display: flex; justify-content: space-between; color: var(--muted); font-size: 10px; font-weight: 600; }
    .meter-head strong { color: var(--text); font-size: 12px; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .row .label { color: var(--muted); }
    .row .value { font-weight: 600; text-align: right; }
    .gauge-wrap { display: flex; gap: 12px; align-items: center; }
    .semi-gauge { width: 118px; height: 70px; flex-shrink: 0; }
    #gaugeArc { transition: stroke-dasharray .35s ease; }
    .stale-banner {
      margin: 0 0 10px;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid rgba(245, 185, 66, 0.35);
      background: rgba(245, 185, 66, 0.1);
      color: var(--warn);
      font-size: 11px;
      line-height: 1.45;
    }
    .gauge-center {
      margin-top: -28px;
      text-align: center;
    }
    .gauge-pct { font-size: 18px; font-weight: 700; line-height: 1; }
    .gauge-lbl { font-size: 9px; color: var(--muted); text-transform: uppercase; margin-top: 2px; letter-spacing: .06em; }
    .gauge-stats { flex: 1; min-width: 0; }
    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
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
    .features { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .feature-chip {
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 10px;
      background: rgba(124,92,255,.1);
      border: 1px solid rgba(124,92,255,.22);
      color: #c4b5fd;
    }
    .calendar-row { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
    .cal-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(124,92,255,.15);
      display: grid;
      place-items: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    .session-list, .model-list { display: grid; gap: 8px; }
    .session-row, .model-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 10px;
      background: var(--panel-2);
      border: 1px solid var(--border);
    }
    .session-row .name, .model-row .name {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .session-row .meta, .model-row .meta { color: var(--muted); font-size: 10px; margin-top: 2px; }
    .muted { color: var(--muted); }
    .spark { width: 100%; height: 52px; display: block; }
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
    input:not([type="checkbox"]):not([type="radio"]), button {
      width: 100%;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #0f1319;
      color: var(--text);
      padding: 8px 10px;
      font: inherit;
    }
    input[type="checkbox"], input[type="radio"] {
      width: auto;
      margin: 0;
      padding: 0;
      flex-shrink: 0;
      accent-color: var(--accent);
      cursor: pointer;
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
    button.ghost { background: transparent; }
    .actions { display: grid; gap: 6px; }
    .error { color: var(--danger); white-space: pre-wrap; font-size: 11px; }
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
    .budget-edit.open { display: block; animation: budgetReveal 0.35s ease-out both; }
    @keyframes budgetReveal {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .cap-edit-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid rgba(91,157,255,.35);
      background: linear-gradient(135deg, rgba(91,157,255,.12), rgba(124,92,255,.1));
      color: var(--accent-2);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      width: auto;
      margin: 0;
      transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
    }
    .cap-edit-btn:hover {
      transform: translateY(-1px);
      border-color: rgba(124,92,255,.55);
      box-shadow: 0 8px 20px rgba(91,157,255,.15);
    }
    .cap-edit-btn .cap-icon {
      width: 14px;
      height: 14px;
      display: inline-grid;
      place-items: center;
      font-size: 12px;
    }
    .section-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      padding: 6px 4px;
      margin: -6px -4px 10px;
      border: none;
      border-radius: 8px;
      background: none;
      color: inherit;
      cursor: pointer;
      text-align: left;
      transition: background .15s ease;
    }
    .section-toggle:hover {
      background: rgba(124, 92, 255, 0.06);
    }
    .section-toggle:focus-visible {
      background: rgba(124, 92, 255, 0.08);
    }
    .section-toggle .section-toggle-label {
      flex: 1;
      min-width: 0;
      margin: 0;
    }
    .section-toggle.nested {
      margin-top: 8px;
      margin-bottom: 8px;
      padding-left: 10px;
      border-left: 2px solid rgba(124, 92, 255, 0.22);
      border-radius: 0 8px 8px 0;
    }
    .section-toggle .chevron {
      width: 22px;
      height: 22px;
      border-radius: 7px;
      border: 1px solid var(--border);
      background: var(--panel-2);
      display: inline-grid;
      place-items: center;
      font-size: 10px;
      color: var(--muted);
      transition: transform .25s ease, color .2s ease, border-color .2s ease, background .2s ease;
      flex-shrink: 0;
    }
    .section-toggle:hover .chevron {
      border-color: rgba(124, 92, 255, 0.45);
      color: var(--accent-2);
      background: rgba(124, 92, 255, 0.08);
    }
    .section-toggle .chevron::before { content: "▾"; }
    .section-toggle[aria-expanded="false"] .chevron { transform: rotate(-90deg); }
    .section-toggle[aria-expanded="false"] + .collapsible-body {
      display: none;
    }
    .collapsible-body { animation: budgetReveal 0.28s ease-out both; }
    .connect-actions {
      display: grid;
      gap: 8px;
      margin-top: 4px;
    }
    .connect-actions button { margin-top: 0; }
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
    .footer-left { display: flex; align-items: center; gap: 6px; color: var(--muted); flex-wrap: wrap; }
    .footer-left a { color: var(--accent-2); text-decoration: none; font-weight: 600; font-size: 11px; }
    .footer-link {
      width: auto;
      margin: 0;
      background: none;
      border: none;
      padding: 0;
      color: var(--accent-2);
      font: inherit;
      font-weight: 600;
      font-size: 11px;
      cursor: pointer;
      text-decoration: underline;
    }
    .footer-dot { opacity: 0.35; }
    .footer-right { color: var(--muted); font-weight: 600; font-size: 11px; }
    .about-card {
      margin-top: 8px;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid rgba(124, 92, 255, 0.22);
      background: rgba(124, 92, 255, 0.06);
    }
    .about-card h2 {
      margin: 0 0 6px;
      font-size: 12px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--accent-2);
    }
    .about-card p { margin: 0 0 8px; font-size: 11px; line-height: 1.5; color: var(--muted); }
    .about-card strong { color: var(--text); }
    .about-card ul { margin: 0 0 8px; padding-left: 16px; font-size: 11px; color: var(--muted); line-height: 1.45; }
    .subscribe-card { display: none; }
    .subscribe-card.visible { display: block; }
    .subscribe-modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(3, 5, 10, 0.72);
      backdrop-filter: blur(4px);
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .subscribe-modal-overlay.visible { display: flex; }
    .subscribe-modal-panel {
      width: min(100%, 360px);
      max-height: 90vh;
      overflow-y: auto;
      padding: 18px;
      border-radius: 14px;
      border: 1px solid rgba(124,92,255,0.35);
      background: linear-gradient(165deg, rgba(18,22,32,0.98), rgba(8,10,16,0.98));
      box-shadow: 0 24px 60px rgba(0,0,0,0.45);
    }
    .subscribe-consent {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      font-size: 10px;
      color: var(--muted);
      margin: 8px 0 10px;
    }
    .subscribe-consent input { margin-top: 2px; }
    .subscribe-btn-loading::after {
      content: '';
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.25);
      border-top-color: #fff;
      border-radius: 50%;
      animation: subscribeSpin 0.75s linear infinite;
      display: inline-block;
      margin-left: 8px;
      vertical-align: middle;
    }
    @keyframes subscribeSpin { to { transform: rotate(360deg); } }
    .reindex-loader-panel { text-align: left; }
    .reindex-loader-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 12px 0 10px;
      min-height: 28px;
    }
    .reindex-loader-row .spinner {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid rgba(124,92,255,.22);
      border-top-color: var(--accent);
      animation: ccm-spin 0.85s linear infinite;
      flex-shrink: 0;
    }
    .reindex-loader-row.is-done .spinner,
    .reindex-loader-row.is-error .spinner { display: none; }
    .reindex-loader-row.is-error #reindexLoaderMessage { color: var(--danger, #ff6b6b); }
    .reindex-loader-row.is-done #reindexLoaderMessage { color: var(--ok, #39ff14); }
    .reindex-progress {
      height: 6px;
      border-radius: 999px;
      background: rgba(124,92,255,.14);
      overflow: hidden;
      margin: 4px 0 10px;
    }
    .reindex-progress-fill {
      height: 100%;
      width: 0%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--accent), var(--accent-2, #5b9dff));
      transition: width 0.25s ease;
    }
    .reindex-loader-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
    }
    .subscribe-hero {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .subscribe-hero img {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      border: 1px solid rgba(124,92,255,0.35);
      flex-shrink: 0;
    }
    .subscribe-title {
      margin: 0 0 4px;
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
      line-height: 1.35;
    }
    .subscribe-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
    .settings-panel { max-height: min(88vh, 640px); overflow-y: auto; }
    .settings-grid { display: flex; flex-direction: column; gap: 10px; }
    .settings-row {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      font-size: 12px; color: var(--muted);
    }
    .settings-row input, .settings-row select {
      width: 120px; padding: 6px 8px; border-radius: 8px;
      border: 1px solid var(--border); background: var(--panel-2); color: var(--text);
    }
    .settings-checklist {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px 0 4px;
      border-top: 1px solid var(--border);
      margin-top: 4px;
    }
    .settings-check {
      display: grid;
      grid-template-columns: 16px 1fr;
      align-items: start;
      column-gap: 10px;
      font-size: 12px;
      color: var(--text);
      cursor: pointer;
      line-height: 1.35;
    }
    .settings-check input[type="checkbox"] {
      width: 16px;
      height: 16px;
      margin-top: 1px;
    }
    .settings-check span { display: block; }
    .cursor-missing-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(3, 5, 10, 0.55);
      backdrop-filter: blur(14px) saturate(1.1);
      padding: 24px 16px;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .cursor-missing-overlay.visible { display: flex; }
    .cursor-missing-card {
      max-width: 360px;
      padding: 24px;
      border-radius: 16px;
      border: 1px solid rgba(255,107,107,.35);
      background: rgba(17, 24, 39, 0.95);
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
    }
    .cursor-missing-eyebrow {
      margin: 0 0 8px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #ff8a8a;
    }
    body.cursor-missing > *:not(.cursor-missing-overlay) {
      filter: blur(8px) saturate(0.85);
      pointer-events: none;
      user-select: none;
    }
    body.cursor-missing .cursor-missing-overlay {
      pointer-events: auto;
    }
    body.cursor-missing .actions button,
    body.cursor-missing .icon-btn,
    body.cursor-missing input,
    body.cursor-missing .edit-link {
      pointer-events: none;
      opacity: 0.45;
    }
    body.cursor-missing #refreshBtn,
    body.cursor-missing #refreshBtn2,
    body.cursor-missing #cursorMissingRefresh,
    body.cursor-missing #cursorMissingBrowser,
    body.cursor-missing #cursorMissingPaste {
      pointer-events: auto;
      opacity: 1;
    }
  </style>
</head>
<body>
  <button type="button" id="loadingState" class="loading-state" disabled aria-live="polite"><span class="spinner" aria-hidden="true"></span><span>Loading dashboard…</span></button>
  <div id="cursorMissingOverlay" class="cursor-missing-overlay" role="alertdialog" aria-modal="true" aria-labelledby="cursorMissingTitle" aria-live="polite">
    <div class="cursor-missing-card">
      <p class="cursor-missing-eyebrow">Connect to Cursor first</p>
      <h2 id="cursorMissingTitle" style="margin:0 0 8px;font-size:18px;">Sign in to view usage</h2>
      <p id="cursorMissingBody" style="margin:0 0 14px;color:var(--muted);font-size:12px;line-height:1.55;">
        Open <strong>cursor.com/dashboard</strong> and sign in, paste an access token, or pick another login found on this computer.
      </p>
      <p style="margin:0 0 14px;color:var(--muted);font-size:11px;line-height:1.5;">
        Explore more Lorapok Labs tools at
        <a href="https://lorapok.tech" target="_blank" rel="noopener" style="color:var(--accent-2);font-weight:600">lorapok.tech</a>.
      </p>
      <div class="connect-actions">
        <button type="button" class="primary" id="cursorMissingBrowser">Sign in with browser</button>
        <button type="button" class="ghost" id="cursorMissingPaste">Paste access token</button>
        <button type="button" class="ghost" id="cursorMissingRefresh">Refresh after connecting</button>
      </div>
    </div>
  </div>
  <header class="header">
    <div class="logo-wrap" id="mascotLogo">${logoSvg}</div>
    <div class="header-text">
      <h1>Usage Dashboard</h1>
      <p id="subtitle">Monitor your API usage and manage your budget.</p>
      <div class="header-status-row">
        <span class="status-chip warn" id="connBadge">Waiting for Cursor login</span>
        <span class="status-chip" id="editorChip" hidden></span>
        <span class="status-chip accent" id="discoveredChip" hidden></span>
      </div>
      <div class="account-switcher">
        <span class="account-switcher-label" id="accountSwitcherLabel">Cursor login</span>
        <label class="sr-only" for="accountSelect">Switch Cursor account for usage stats</label>
        <select id="accountSelect" aria-label="Switch Cursor account for usage stats"></select>
        <button type="button" class="icon-btn" id="addAccountBtn" title="Add another Cursor login" aria-label="Add another Cursor login">+</button>
        <button type="button" class="icon-btn" id="removeAccountBtn" title="Remove saved login" aria-label="Remove saved login">−</button>
        <p class="account-switcher-hint" id="accountSwitcherHint" hidden>
          Multiple Cursor installs were detected on this PC. Pick a login to view its usage, or add another with +.
        </p>
      </div>
    </div>
    <div class="header-actions">
      <button type="button" class="icon-btn" id="settingsBtn" title="Extension settings" aria-label="Extension settings">⚙</button>
      <button type="button" class="icon-btn" id="refreshBtn" title="Refresh" aria-label="Refresh dashboard">↻</button>
    </div>
  </header>

  <div id="connectBanner" class="connect-banner" role="status" aria-live="polite"></div>

  <div id="errorBox" class="card error" style="display:none"></div>

  <section class="card" id="usageCard">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <p class="section-label" style="margin:0;">
        <span style="display:inline-block; width:16px; height:16px; vertical-align:middle;">${usageMeterSvg}</span>
        Included quota
      </p>
      <div style="display:flex;align-items:center;gap:6px">
        <button type="button" class="icon-btn" id="usageHelpBtn" title="How usage is calculated" aria-label="Usage help">?</button>
        <span id="statusPill" class="pill ok">OK</span>
      </div>
    </div>
    <div id="staleLimitBanner" class="stale-banner" style="display:none" role="status"></div>
    <div class="usage-big" id="usageBig" aria-live="polite">—%</div>
    <div class="usage-sub" id="usageSub">of included quota used</div>
    <div class="bar" role="progressbar" aria-label="Included quota usage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="usageBarTrack">
      <div class="bar-threshold" id="thresholdLine" style="left:80%"></div>
      <div class="fill" id="usageBar"></div>
    </div>
    <div class="row">
      <span class="label">Used</span>
      <span class="value" id="usedValue">—</span>
    </div>
    <div class="row">
      <span class="label">Remaining</span>
      <span class="value" id="remainingValue">—</span>
    </div>
    <div class="dual-meters">
      <div class="meter-row">
        <div class="meter-head"><span>Auto</span><strong id="autoPct">—%</strong></div>
        <div class="meter-track" role="progressbar" aria-label="Auto usage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="autoBarTrack"><div class="meter-fill" id="autoBar"></div></div>
      </div>
      <div class="meter-row">
        <div class="meter-head"><span>API</span><strong id="apiPct">—%</strong></div>
        <div class="meter-track" role="progressbar" aria-label="API usage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="apiBarTrack"><div class="meter-fill" id="apiBar"></div></div>
      </div>
    </div>
    <button type="button" class="section-toggle nested" id="usageBreakdownToggle" aria-expanded="true" aria-controls="usageBreakdownBody" aria-label="Toggle usage breakdown" style="margin-top:14px">
      <span class="section-label section-toggle-label">Usage breakdown</span>
      <span class="chevron" aria-hidden="true"></span>
    </button>
    <div class="collapsible-body" id="usageBreakdownBody">
      <div class="row">
        <span class="label">Included used</span>
        <span class="value" id="includedPoolUsedVal">—</span>
      </div>
      <div class="row">
        <span class="label">Included remaining</span>
        <span class="value" id="includedPoolRemainingVal">—</span>
      </div>
      <div class="row" id="bonusBreakdownRow" style="display:none">
        <span class="label" id="bonusBreakdownLabel">Agent credits</span>
        <span class="value" id="bonusBreakdownVal">—</span>
      </div>
      <div class="row">
        <span class="label">Auto model</span>
        <span class="value" id="breakdownAutoVal">—</span>
      </div>
      <div class="row">
        <span class="label">API model</span>
        <span class="value" id="breakdownApiVal">—</span>
      </div>
      <div class="row">
        <span class="label">Cycle reset</span>
        <span class="value" id="breakdownResetVal">—</span>
      </div>
    </div>
  </section>

  <section class="card" id="budgetTrackerCard">
    <p class="section-label">Budget tracker</p>
    <div class="gauge-wrap">
      <div>
        <svg class="semi-gauge" viewBox="0 0 140 82">
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#5b9dff"/>
              <stop offset="100%" stop-color="#f5b942"/>
            </linearGradient>
          </defs>
          <path d="M 14 70 A 56 56 0 0 1 126 70" fill="none" stroke="#252b38" stroke-width="10" stroke-linecap="round"/>
          <path id="gaugeArc" d="M 14 70 A 56 56 0 0 1 126 70" fill="none" stroke="url(#gaugeGrad)" stroke-width="10" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/>
        </svg>
        <div class="gauge-center" aria-live="polite">
          <div class="gauge-pct" id="gaugePct">0%</div>
          <div class="gauge-lbl" id="gaugeLbl">quota</div>
        </div>
      </div>
      <div class="gauge-stats">
        <div id="thresholdPill" class="pill warn" style="display:none;margin-bottom:8px">threshold</div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="k" id="budgetCapLabel">Total pool</div>
            <div class="v" id="budgetCapVal">—</div>
          </div>
          <div class="stat-box">
            <div class="k" id="amountLeftLabel">Quota left</div>
            <div class="v" id="amountLeftVal">—</div>
          </div>
          <div class="stat-box">
            <div class="k">On-demand</div>
            <div class="v" id="onDemandVal">—</div>
          </div>
          <div class="stat-box">
            <div class="k">Team on-demand</div>
            <div class="v" id="teamOnDemandVal">—</div>
          </div>
        </div>
      </div>
    </div>
    <div class="row" style="margin-top:12px" id="personalCapRow" hidden>
      <div>
        <div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">On-demand cap</div>
        <div id="budgetCapBig" style="font-size:18px;font-weight:700;margin-top:2px">$0.00</div>
        <div class="usage-sub" style="margin:0">USD · personal spend limit</div>
      </div>
      <button class="cap-edit-btn" id="editBudgetBtn" type="button" aria-expanded="false" aria-controls="budgetEdit">
        <span class="cap-icon" aria-hidden="true">✎</span>
        <span>Edit cap</span>
      </button>
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
      <div style="flex:1;min-width:0">
        <div class="value" id="resetText">Resets on —</div>
        <div class="usage-sub" id="cycleRange" style="margin:0">—</div>
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
    <div class="features" id="featureChips"></div>
  </section>

  <section class="card" id="localInsightsCard">
    <button type="button" class="section-toggle" id="localInsightsToggle" aria-expanded="true" aria-controls="localInsightsBody" aria-label="Toggle local insights section">
      <span class="section-label section-toggle-label">Local insights</span>
      <span class="chevron" aria-hidden="true"></span>
    </button>
    <div class="collapsible-body" id="localInsightsBody">
      <div class="stat-grid" style="margin-bottom:10px">
        <div class="stat-box">
          <div class="k">Today accepted</div>
          <div class="v" id="todayAccepted">—</div>
        </div>
        <div class="stat-box">
          <div class="k">Cycle accepted</div>
          <div class="v" id="cycleAccepted">—</div>
        </div>
      </div>
      <button type="button" class="section-toggle nested" id="activeModelsToggle" aria-expanded="true" aria-controls="activeModelsBody" aria-label="Toggle active models">
        <span class="section-label section-toggle-label">Active models</span>
        <span class="chevron" aria-hidden="true"></span>
      </button>
      <div class="collapsible-body" id="activeModelsBody">
        <div class="model-list" id="modelList"><div class="muted">No local model data</div></div>
      </div>
      <button type="button" class="section-toggle nested" id="recentSessionsToggle" aria-expanded="true" aria-controls="recentSessionsBody" aria-label="Toggle recent sessions">
        <span class="section-label section-toggle-label">Recent sessions</span>
        <span class="chevron" aria-hidden="true"></span>
      </button>
      <div class="collapsible-body" id="recentSessionsBody">
        <div class="session-list" id="sessionList"><div class="muted">No recent sessions</div></div>
      </div>
    </div>
  </section>

  <section class="card">
    <p class="section-label">Cycle trend</p>
    <div id="sparkEmpty" class="muted">Trend builds as usage is polled.</div>
    <svg class="spark" id="sparkSvg" viewBox="0 0 220 52" preserveAspectRatio="none" style="display:none"></svg>
  </section>

  <section class="card">
    <p class="section-label">Data recovery</p>
    <p class="muted" style="margin:0 0 10px;font-size:11px;line-height:1.45">
      Restore missing agent chats to search and the IDE sidebar when worktree or workspace changes orphaned your conversation history. Existing chats are preserved; only missing transcripts are indexed.
    </p>
    <div class="row" style="margin-top:0">
      <span class="label">Conversation repair</span>
      <span class="value">Aug 10+ transcripts</span>
    </div>
    <button class="ghost" id="reindexBtn" style="margin-top:10px;width:100%">Reindex missing conversations</button>
    <p class="muted" style="margin:14px 0 10px;font-size:11px;line-height:1.45">
      Older extension builds could leave multi-gigabyte <span class="mono">state.vscdb.backup-*</span> files in globalStorage. Cleanup removes only those stale copies — your live Cursor database is never modified.
    </p>
    <div class="row" style="margin-top:0">
      <span class="label">Stale DB backups</span>
      <span class="value" id="dbBackupSummary">Scanning…</span>
    </div>
    <button class="ghost" id="recoverDbBackupsBtn" style="margin-top:10px;width:100%" disabled>Remove stale database backups</button>
  </section>

  <div class="subscribe-modal-overlay" id="usageHelpModal" aria-hidden="true">
    <div class="subscribe-modal-panel" role="dialog" aria-modal="true" aria-labelledby="usageHelpTitle" tabindex="-1">
      <p class="cursor-missing-eyebrow">Usage guide</p>
      <h2 id="usageHelpTitle" style="margin:0 0 8px;font-size:16px">How Cursor usage is calculated</h2>
      <div class="muted" style="margin:0 0 14px;font-size:11px;line-height:1.55;text-align:left">
        <p style="margin:0 0 10px"><strong>Included pool</strong> — your plan&apos;s base quota for the billing cycle.</p>
        <p style="margin:0 0 10px"><strong>Agent credits (bonus)</strong> — extra gifted units Cursor adds on top of included. They count toward your total pool before you hit the limit.</p>
        <p style="margin:0 0 10px"><strong>Auto / API %</strong> — how much of each model class you&apos;ve used. The hero meter uses the highest of pool %, Auto, or API.</p>
        <p style="margin:0 0 10px"><strong>On-demand spend</strong> — optional USD billing when enabled. Personal cap editing is only available when on-demand is on or you have on-demand spend.</p>
        <p style="margin:0"><strong>Why 100% can look stale</strong> — Cursor&apos;s API sometimes reports 100% on included quota while bonus credits remain. We show a warning when that happens.</p>
      </div>
      <div class="connect-actions">
        <a class="ghost" href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener" style="text-decoration:none;text-align:center">Join Discord</a>
        <a class="ghost" href="mailto:${SUPPORT_EMAIL}" style="text-decoration:none;text-align:center">Email help</a>
        <button type="button" class="primary" id="usageHelpClose">Got it</button>
      </div>
    </div>
  </div>

  <div class="subscribe-modal-overlay" id="settingsModal" aria-hidden="true">
    <div class="subscribe-modal-panel settings-panel" role="dialog" aria-modal="true" aria-labelledby="settingsTitle" tabindex="-1">
      <p class="cursor-missing-eyebrow">Extension settings</p>
      <h2 id="settingsTitle" style="margin:0 0 8px;font-size:16px">Dashboard & editor preferences</h2>
      <p class="muted" style="margin:0 0 14px;font-size:11px;line-height:1.5">
        These map to VS Code settings under <strong>Cursor Curse Monitor</strong>. Useful while Cursor Agent runs in this workspace.
      </p>
      <div class="settings-grid">
        <label class="settings-row">
          <span>Poll interval (seconds)</span>
          <input id="setPollInterval" type="number" min="15" max="3600" step="15" />
        </label>
        <label class="settings-row">
          <span>Warn at usage %</span>
          <input id="setWarnPercent" type="number" min="1" max="100" step="1" />
        </label>
        <label class="settings-row">
          <span>Status bar source</span>
          <select id="setStatusBarSource">
            <option value="plan">Plan quota</option>
            <option value="autoApi">Auto + API</option>
            <option value="both">Plan + Auto/API</option>
          </select>
        </label>
        <div class="settings-checklist">
        <label class="settings-check"><input type="checkbox" id="setShowStatusBar" /><span>Show status bar usage</span></label>
        <label class="settings-check"><input type="checkbox" id="setAutoFallback" checked /><span>Auto-apply fallback model at 100%</span></label>
        <label class="settings-check"><input type="checkbox" id="setProductNotices" /><span>Show product notices</span></label>
        <label class="settings-check"><input type="checkbox" id="setSecurityScan" /><span>Security scan enabled</span></label>
        <label class="settings-check"><input type="checkbox" id="setScanOnSave" /><span>Scan on save</span></label>
        <label class="settings-check"><input type="checkbox" id="setBlockSave" /><span>Block save when secrets detected</span></label>
        <label class="settings-check"><input type="checkbox" id="setAnonymousStats" checked /><span>Anonymous usage heartbeat</span></label>
        </div>
      </div>
      <div class="subscribe-actions" style="margin-top:14px">
        <button type="button" class="primary" id="settingsSaveBtn" style="width:100%">Save settings</button>
        <button type="button" class="ghost" id="settingsCancelBtn" style="width:100%">Cancel</button>
      </div>
      <p class="muted" id="settingsStatus" style="margin:8px 0 0;font-size:11px"></p>
    </div>
  </div>

  <div class="subscribe-modal-overlay" id="reindexModal" aria-hidden="true">
    <div class="subscribe-modal-panel" role="dialog" aria-modal="true" aria-labelledby="reindexTitle" tabindex="-1">
      <p class="cursor-missing-eyebrow" style="color:var(--warn)">Data recovery</p>
      <h2 id="reindexTitle" style="margin:0 0 8px;font-size:16px">Reindex missing conversations?</h2>
      <p class="muted" style="margin:0 0 14px;font-size:11px;line-height:1.5" id="reindexPolicyBody">
        This rebuilds search indexes and restores orphaned agent chats from Aug 10 onward.
        A backup is created first. Live reindex runs while the editor is open unless Mission Control requires a full quit.
      </p>
      <div class="subscribe-actions">
        <button type="button" class="primary" id="reindexConfirm" style="width:100%">Reindex now</button>
        <button type="button" class="ghost" id="reindexCancel" style="width:100%">Cancel</button>
      </div>
    </div>
  </div>

  <div class="subscribe-modal-overlay" id="reindexLoader" aria-hidden="true">
    <div class="subscribe-modal-panel reindex-loader-panel" role="status" aria-live="polite" aria-busy="true">
      <p class="cursor-missing-eyebrow" style="color:var(--warn)">Data recovery</p>
      <h2 style="margin:0 0 4px;font-size:16px">Reindexing conversations…</h2>
      <div class="reindex-loader-row" id="reindexLoaderRow">
        <span class="spinner" id="reindexLoaderSpinner" aria-hidden="true"></span>
        <span id="reindexLoaderMessage">Starting…</span>
      </div>
      <div class="reindex-progress" id="reindexProgressBar" hidden>
        <div class="reindex-progress-fill" id="reindexProgressFill"></div>
      </div>
      <p class="muted" id="reindexLoaderHint" style="margin:0;font-size:11px;line-height:1.5">
        Creating backups, then rebuilding search indexes and sidebar entries. This can take a minute on large workspaces.
      </p>
      <div class="reindex-loader-actions" id="reindexLoaderActions" hidden>
        <button type="button" class="ghost" id="reindexLoaderClose" style="width:100%">Close</button>
      </div>
    </div>
  </div>

  <div class="subscribe-modal-overlay" id="recoverDbBackupsModal" aria-hidden="true">
    <div class="subscribe-modal-panel" role="dialog" aria-modal="true" aria-labelledby="recoverDbBackupsTitle" tabindex="-1">
      <p class="cursor-missing-eyebrow" style="color:var(--warn)">Disk recovery</p>
      <h2 id="recoverDbBackupsTitle" style="margin:0 0 8px;font-size:16px">Remove stale database backups?</h2>
      <p class="muted" style="margin:0 0 10px;font-size:11px;line-height:1.5" id="recoverDbBackupsBody">
        This deletes leftover <span class="mono">state.vscdb.backup-*</span> files only. Your live Cursor database and chat history stay intact.
      </p>
      <div class="subscribe-actions">
        <button type="button" class="primary" id="recoverDbBackupsConfirm" style="width:100%">Remove backups now</button>
        <button type="button" class="ghost" id="recoverDbBackupsCancel" style="width:100%">Cancel</button>
      </div>
    </div>
  </div>

  <div class="subscribe-modal-overlay" id="subscribeModal" aria-hidden="true">
    <div class="subscribe-modal-panel" role="dialog" aria-modal="true" aria-labelledby="subscribeTitle" aria-describedby="subscribeBody" tabindex="-1" id="subscribePanel">
      <div class="subscribe-hero">
        <img src="${iconUri}" alt="" width="44" height="44" />
        <div>
          <p class="subscribe-title" id="subscribeTitle">Release updates</p>
          <p class="muted" id="subscribeBody" style="margin:0;font-size:11px;line-height:1.45"></p>
        </div>
      </div>
      <input id="subscribeEmail" type="email" placeholder="you@example.com" style="width:100%;margin-bottom:8px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--panel-2);color:var(--text)" />
      <label class="subscribe-consent" for="subscribeConsent">
        <input type="checkbox" id="subscribeConsent" />
        <span>I agree to receive product updates from Lorapok Labs.</span>
      </label>
      <div class="subscribe-actions">
        <button class="primary" id="subscribeBtn" style="width:100%">Subscribe to updates</button>
        <button class="ghost" id="subscribeLaterBtn" style="width:100%">Maybe later</button>
        <button class="ghost" id="subscribeDeclineBtn" style="width:100%">No thanks</button>
      </div>
      <p class="muted" id="subscribeStatus" style="margin:8px 0 0;font-size:11px"></p>
    </div>
  </div>

  <section class="card">
    <p class="section-label">Fallback</p>
    <div class="row" style="margin-top:0">
      <span class="label">Fallback model</span>
      <span class="value mono">composer-2.5 · fast: false</span>
    </div>
    <div class="row">
      <span class="label">Auto-switched</span>
      <span class="value" id="autoSwitchText">No</span>
    </div>
  </section>

  <section class="card about-card">
    <h2>About</h2>
    <p><strong>${esc(SUPPORTED_IDE_WRAPPERS_HEADLINE)}</strong> — ${esc(SUPPORTED_IDE_WRAPPERS_SUBLINE)}</p>
    <ul>
      <li>Live quota, billing cycle, on-demand spend, and budget caps</li>
      <li>Automatic Composer 2.5 (Fast off) fallback at 100%</li>
      <li>Local workspace credential scanner — nothing leaves your machine</li>
    </ul>
    <p><strong>Supported IDEs:</strong> ${supportedIdeNames}. More tools at <a href="https://lorapok.tech" target="_blank" rel="noopener">lorapok.tech</a>.</p>
    <div class="community-stats" id="communityStats">
      <p class="section-label" style="margin-top:12px">Community</p>
      <p class="muted" id="communityStatsHeadline" style="margin:0;font-size:12px">Loading marketplace stats…</p>
      <p class="muted" id="communityStatsBreakdown" style="margin:4px 0 0;font-size:11px"></p>
    </div>
  </section>

  <div class="footer-msg">
    <span class="footer-shield" aria-hidden="true">◆</span>
    <span id="footerMsg">You're in control. We'll notify you before you reach your cap.</span>
  </div>

  <div class="actions">
    <button type="button" class="ghost" id="refreshBtn2" aria-label="Refresh dashboard data">Refresh data</button>
    <button class="ghost" id="fallbackBtn">Apply free fallback model</button>
  </div>

  <footer class="footer">
    <div class="footer-left">
      <span>A product of</span>
      <a href="https://lorapok.tech" target="_blank">Lorapok Labs</a>
      <span class="footer-dot">·</span>
      <a href="mailto:cursor.curse.help@lorapok.tech">Help</a>
      <span class="footer-dot">·</span>
      <a href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener">Discord</a>
      <span class="footer-dot">·</span>
      <button type="button" class="footer-link" id="feedbackBtn">Feedback</button>
      <span class="footer-dot">·</span>
      <a href="mailto:cursor.monitor@lorapok.tech">Updates</a>
    </div>
    <div class="footer-right">v${extensionVersion}</div>
  </footer>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const bootSnapshot = ${bootJson};
    let editorSettings = ${bootSettingsJson};

    function dismissLoading() {
      var loading = document.getElementById('loadingState');
      if (loading) loading.remove();
    }

    function signalReady() {
      vscode.postMessage({ type: 'ready' });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', signalReady);
    } else {
      signalReady();
    }
    setTimeout(signalReady, 100);
    setTimeout(signalReady, 500);

    function onClick(id, handler) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', handler);
    }

    function money(n) {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n || 0);
    }
    function pct(n) {
      if (!Number.isFinite(n)) return '0';
      return String(Math.round(n * 10) / 10);
    }
    function escHtml(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
    function fillClass(pctVal, threshold, limitExceeded) {
      return limitExceeded ? ' free' :
        pctVal >= 100 ? ' danger' :
        pctVal >= threshold ? ' warn' : '';
    }
    function setGauge(value) {
      const arc = document.getElementById('gaugeArc');
      const clamped = Math.max(0, Math.min(100, value));
      arc.setAttribute('stroke-dasharray', clamped + ' 100');
      document.getElementById('gaugePct').textContent = Math.round(clamped) + '%';
    }
    function renderSpark(points, threshold) {
      const svg = document.getElementById('sparkSvg');
      const empty = document.getElementById('sparkEmpty');
      if (!points || points.length < 2) {
        svg.style.display = 'none';
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';
      svg.style.display = 'block';
      const w = 220, h = 52, pad = 4;
      const xs = points.map(function(_, i) {
        return pad + (i / (points.length - 1)) * (w - pad * 2);
      });
      const ys = points.map(function(p) {
        return pad + (1 - Math.min(100, p.includedPercent || 0) / 100) * (h - pad * 2);
      });
      const d = xs.map(function(x, i) { return (i ? 'L' : 'M') + x.toFixed(1) + ',' + ys[i].toFixed(1); }).join(' ');
      const threshY = pad + (1 - Math.min(100, threshold) / 100) * (h - pad * 2);
      svg.innerHTML =
        '<line x1="' + pad + '" y1="' + threshY.toFixed(1) + '" x2="' + (w - pad) + '" y2="' + threshY.toFixed(1) +
        '" stroke="#f5b942" stroke-dasharray="4 4" stroke-width="1" opacity="0.7"></line>' +
        '<path d="' + d + '" fill="none" stroke="#5b9dff" stroke-width="2"></path>';
    }

    function setProgressTrack(track, value) {
      if (!track) return;
      var v = Math.max(0, Math.min(100, Math.round(value)));
      track.setAttribute('aria-valuenow', String(v));
    }

    function trapSubscribeFocus(modal) {
      var panel = document.getElementById('subscribePanel');
      if (!panel) return;
      var focusable = panel.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])');
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (first) first.focus();
      function onKey(e) {
        if (e.key === 'Escape') {
          vscode.postMessage({ type: 'snoozeSubscribe' });
          return;
        }
        if (e.key !== 'Tab' || !focusable.length) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          if (last) last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          if (first) first.focus();
        }
      }
      modal.addEventListener('keydown', onKey);
    }

    function applyEditorSettingsForm(settings) {
      if (!settings) return;
      editorSettings = settings;
      var poll = document.getElementById('setPollInterval');
      var warn = document.getElementById('setWarnPercent');
      var source = document.getElementById('setStatusBarSource');
      if (poll) poll.value = String(settings.pollIntervalSeconds ?? 60);
      if (warn) warn.value = String(settings.warnAtPercent ?? 80);
      if (source) source.value = settings.statusBarUsageSource || 'autoApi';
      var map = [
        ['setShowStatusBar', 'showStatusBar'],
        ['setAutoFallback', 'autoApplyFallbackModel'],
        ['setProductNotices', 'productNotices'],
        ['setSecurityScan', 'securityScanEnabled'],
        ['setScanOnSave', 'scanOnSave'],
        ['setBlockSave', 'blockSaveOnSecret'],
        ['setAnonymousStats', 'anonymousUsageStats'],
      ];
      map.forEach(function(pair) {
        var el = document.getElementById(pair[0]);
        if (el) el.checked = !!settings[pair[1]];
      });
    }

    function openSettingsModal() {
      applyEditorSettingsForm(editorSettings);
      var modal = document.getElementById('settingsModal');
      var status = document.getElementById('settingsStatus');
      if (status) status.textContent = '';
      if (modal) {
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        var saveBtn = document.getElementById('settingsSaveBtn');
        if (saveBtn) saveBtn.focus();
      }
    }

    function closeSettingsModal() {
      var modal = document.getElementById('settingsModal');
      if (modal) {
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
      }
    }

    function formatUnits(n) {
      return (Number(n) || 0).toLocaleString();
    }

    function collectEditorSettingsFromForm() {
      return {
        pollIntervalSeconds: Number(document.getElementById('setPollInterval')?.value || 60),
        warnAtPercent: Number(document.getElementById('setWarnPercent')?.value || 80),
        statusBarUsageSource: document.getElementById('setStatusBarSource')?.value || 'autoApi',
        showStatusBar: !!document.getElementById('setShowStatusBar')?.checked,
        autoApplyFallbackModel: !!document.getElementById('setAutoFallback')?.checked,
        productNotices: !!document.getElementById('setProductNotices')?.checked,
        securityScanEnabled: !!document.getElementById('setSecurityScan')?.checked,
        scanOnSave: !!document.getElementById('setScanOnSave')?.checked,
        blockSaveOnSecret: !!document.getElementById('setBlockSave')?.checked,
        anonymousUsageStats: !!document.getElementById('setAnonymousStats')?.checked,
      };
    }

    function renderAccounts(snapshot) {
      var sel = document.getElementById('accountSelect');
      var removeBtn = document.getElementById('removeAccountBtn');
      var hint = document.getElementById('accountSwitcherHint');
      if (!sel) return;
      var accounts = snapshot.accounts || [];
      var active = snapshot.activeAccountId || 'system';
      sel.innerHTML = accounts.map(function(a) {
        var label = a.label || a.email || a.id;
        if (a.id === active) {
          label = label + ' · active';
        }
        return '<option value="' + escHtml(a.id) + '">' + escHtml(label) + '</option>';
      }).join('');
      if (!accounts.length) {
        sel.innerHTML = '<option value="system">This Cursor session</option>';
      }
      sel.value = active;
      var selected = accounts.filter(function(a) { return a.id === sel.value; })[0];
      if (removeBtn) {
        removeBtn.disabled = !selected || selected.source === 'system' || selected.source === 'discovered';
      }
      if (hint) {
        var discoveredCount = (snapshot.discoveredLoginCount || 0);
        hint.hidden = accounts.length < 2 && discoveredCount < 2;
      }
    }

    var snapshotReceived = Boolean(bootSnapshot);

    function render(snapshot) {
      snapshotReceived = true;
      const loading = document.getElementById('loadingState');
      if (loading) loading.remove();
      renderAccounts(snapshot);
      const b = snapshot.budget;
      const usage = snapshot.usage;
      const errorBox = document.getElementById('errorBox');
      const missingOverlay = document.getElementById('cursorMissingOverlay');
      const connectBanner = document.getElementById('connectBanner');
      const missingBody = document.getElementById('cursorMissingBody');
      if (snapshot.cursorMissing) {
        document.body.classList.add('cursor-missing');
        if (missingOverlay) missingOverlay.classList.add('visible');
        if (connectBanner) {
          connectBanner.classList.add('visible');
          connectBanner.innerHTML = '<strong>Not connected.</strong> ' + escHtml(snapshot.error || 'Sign in to Cursor or choose another login from the switcher.');
        }
        if (missingBody && snapshot.discoveredLoginCount && snapshot.discoveredLoginCount > 1) {
          missingBody.innerHTML = snapshot.discoveredLoginCount + ' Cursor logins were found on this computer. Pick one in the account switcher above, or sign in at <strong>cursor.com/dashboard</strong>.';
        }
      } else {
        document.body.classList.remove('cursor-missing');
        if (missingOverlay) missingOverlay.classList.remove('visible');
        if (connectBanner) connectBanner.classList.remove('visible');
      }

      const local = snapshot.local || {};
      const teamBit = local.teamName ? ' · ' + local.teamName : '';
      const multiAccount = (snapshot.accounts || []).length > 1;
      const emailLead = snapshot.email
        ? (multiAccount ? 'Stats for ' + snapshot.email : snapshot.email)
        : '';
      const hostLabel = snapshot.host === 'vscode' ? 'VS Code host' : snapshot.host === 'cursor' ? 'Cursor host' : 'Editor host';
      const productLabel = snapshot.monitoringProduct ? 'Data: ' + snapshot.monitoringProduct : '';
      document.getElementById('subtitle').textContent = [
        emailLead ? emailLead + teamBit : '',
        productLabel,
        hostLabel,
        'Lorapok Labs · ' + new Date(snapshot.fetchedAt).toLocaleTimeString()
      ].filter(Boolean).join(' · ');

      const connBadge = document.getElementById('connBadge');
      const editorChip = document.getElementById('editorChip');
      const discoveredChip = document.getElementById('discoveredChip');
      if (snapshot.error) {
        errorBox.style.display = 'block';
        errorBox.textContent = snapshot.error;
        if (connBadge) {
          connBadge.className = 'status-chip warn';
          connBadge.textContent = snapshot.cursorMissing ? 'Not signed in' : 'Connection issue';
        }
      } else {
        errorBox.style.display = 'none';
        if (connBadge) {
          connBadge.className = 'status-chip ok';
          connBadge.textContent = usage && snapshot.fetchedAt
            ? 'Live · ' + new Date(snapshot.fetchedAt).toLocaleTimeString()
            : 'Connected';
        }
      }
      if (editorChip) {
        const editorBits = [];
        if (snapshot.editorAppName) editorBits.push(snapshot.editorAppName);
        if (snapshot.monitoringProduct) editorBits.push('DB ' + snapshot.monitoringProduct);
        if (editorBits.length) {
          editorChip.hidden = false;
          editorChip.textContent = editorBits.join(' · ');
        } else {
          editorChip.hidden = true;
        }
      }
      if (discoveredChip) {
        const count = snapshot.discoveredLoginCount || 0;
        if (count > 1) {
          discoveredChip.hidden = false;
          discoveredChip.textContent = count + ' logins on this PC';
        } else {
          discoveredChip.hidden = true;
        }
      }

      const models = local.models || [];
      document.getElementById('modelList').innerHTML = models.length
        ? models.map(function(m) {
            return '<div class="model-row"><div><div class="name">' + escHtml(m.label) + '</div><div class="meta">' +
              escHtml(m.surface) + '</div></div><div class="mono">' + escHtml(m.modelName) + '</div></div>';
          }).join('')
        : '<div class="muted">No local model data</div>';
      if (local.lastUsedModel) {
        document.getElementById('modelList').insertAdjacentHTML('afterbegin',
          '<div class="muted" style="font-size:10px">Last used · ' + escHtml(local.lastUsedModel) + '</div>');
      }

      const sessions = local.sessions || [];
      document.getElementById('sessionList').innerHTML = sessions.length
        ? sessions.map(function(s) {
            return '<div class="session-row"><div style="min-width:0"><div class="name">' + escHtml(s.name) +
              '</div><div class="meta">' + escHtml(s.mode) + ' · ' + escHtml(s.recencyLabel) + '</div></div>' +
              '<div class="muted">+' + (s.linesAdded || 0) + ' / −' + (s.linesRemoved || 0) + '</div></div>';
          }).join('')
        : '<div class="muted">No recent sessions</div>';

      const today = local.today;
      const todayAcc = today ? (today.tabAcceptedLines + today.composerAcceptedLines) : 0;
      const todaySug = today ? (today.tabSuggestedLines + today.composerSuggestedLines) : 0;
      document.getElementById('todayAccepted').textContent =
        todayAcc + ' / ' + todaySug + ' lines';
      document.getElementById('cycleAccepted').textContent =
        (local.cycleAccepted || 0) + ' lines';

      if (!usage || !b) {
        const usageBig = document.getElementById('usageBig');
        const usageSub = document.getElementById('usageSub');
        if (usageBig) usageBig.textContent = '—';
        if (usageSub) {
          usageSub.textContent = snapshot.error
            ? 'Sign in to Cursor and refresh'
            : 'Waiting for usage data…';
        }
        renderSpark(snapshot.history || [], editorSettings.warnAtPercent ?? 80);
        return;
      }

      const hero = b.percentUsed;
      const threshold = b.thresholdPercent;
      document.getElementById('thresholdLine').style.left = threshold + '%';
      document.getElementById('usageBig').textContent = Math.round(hero) + '%';
      document.getElementById('usageSub').textContent = b.usdBudgetActive
        ? 'of personal spend cap used'
        : (b.planBreakdownBonus > 0
          ? 'of total pool used (included + bonus)'
          : 'of included quota used');

      const usageBar = document.getElementById('usageBar');
      usageBar.style.width = Math.min(100, hero) + '%';
      usageBar.className = 'fill' + fillClass(hero, threshold, snapshot.limitExceeded);
      setProgressTrack(document.getElementById('usageBarTrack'), hero);

      const statusPill = document.getElementById('statusPill');
      if (snapshot.limitExceeded) {
        statusPill.className = 'pill free';
        statusPill.textContent = 'FREE FALLBACK';
      } else if (hero >= threshold) {
        statusPill.className = 'pill warn';
        statusPill.textContent = 'WARNING';
      } else {
        statusPill.className = 'pill ok';
        statusPill.textContent = 'OK';
      }

      document.getElementById('usedValue').textContent =
        formatUnits(b.includedUsed) + ' / ' + formatUnits(b.includedLimit) + ' units';
      document.getElementById('remainingValue').textContent = formatUnits(b.includedRemaining) + ' units';

      var staleBanner = document.getElementById('staleLimitBanner');
      if (staleBanner) {
        if (b.staleLimitBanner && b.staleLimitMessage) {
          staleBanner.style.display = 'block';
          staleBanner.textContent = b.staleLimitMessage;
        } else {
          staleBanner.style.display = 'none';
          staleBanner.textContent = '';
        }
      }

      var includedPoolUsed = b.includedPoolUsed != null ? b.includedPoolUsed : b.includedUsed;
      var includedPoolRemaining = b.includedPoolRemaining != null
        ? b.includedPoolRemaining
        : Math.max(0, (b.planBreakdownIncluded || b.includedLimit) - includedPoolUsed);
      document.getElementById('includedPoolUsedVal').textContent =
        formatUnits(includedPoolUsed) + ' / ' + formatUnits(b.planBreakdownIncluded || b.includedLimit);
      document.getElementById('includedPoolRemainingVal').textContent =
        formatUnits(includedPoolRemaining) + ' units';
      var bonusRow = document.getElementById('bonusBreakdownRow');
      if (bonusRow) {
        if (b.planBreakdownBonus > 0) {
          bonusRow.style.display = 'flex';
          var bonusLabel = document.getElementById('bonusBreakdownLabel');
          if (bonusLabel) bonusLabel.textContent = b.bonusLabel || 'Agent credits';
          document.getElementById('bonusBreakdownVal').textContent =
            formatUnits(b.bonusUsed || 0) + ' used · ' + formatUnits(b.bonusRemaining || 0) + ' left';
        } else {
          bonusRow.style.display = 'none';
        }
      }
      document.getElementById('breakdownAutoVal').textContent = pct(b.autoPercentUsed) + '%';
      document.getElementById('breakdownApiVal').textContent = pct(b.apiPercentUsed) + '%';
      document.getElementById('breakdownResetVal').textContent = b.resetDateLabel + ' (' + b.daysUntilReset + 'd)';

      document.getElementById('autoPct').textContent = pct(b.autoPercentUsed) + '%';
      document.getElementById('apiPct').textContent = pct(b.apiPercentUsed) + '%';
      const autoBar = document.getElementById('autoBar');
      const apiBar = document.getElementById('apiBar');
      autoBar.style.width = Math.min(100, b.autoPercentUsed) + '%';
      apiBar.style.width = Math.min(100, b.apiPercentUsed) + '%';
      autoBar.className = 'meter-fill' + fillClass(b.autoPercentUsed, threshold, snapshot.limitExceeded);
      apiBar.className = 'meter-fill' + fillClass(b.apiPercentUsed, threshold, snapshot.limitExceeded);
      setProgressTrack(document.getElementById('autoBarTrack'), b.autoPercentUsed);
      setProgressTrack(document.getElementById('apiBarTrack'), b.apiPercentUsed);

      const gaugeValue = b.usdBudgetActive ? b.budgetPercentUsed : hero;
      setGauge(gaugeValue);
      document.getElementById('gaugeLbl').textContent = b.usdBudgetActive ? 'spend' : 'quota';
      const budgetCapLabel = document.getElementById('budgetCapLabel');
      const amountLeftLabel = document.getElementById('amountLeftLabel');
      if (budgetCapLabel) {
        budgetCapLabel.textContent = b.usdBudgetActive ? 'Spend cap' : 'Total pool';
      }
      if (amountLeftLabel) {
        amountLeftLabel.textContent = b.usdBudgetActive ? 'Spend left' : 'Quota left';
      }
      document.getElementById('budgetCapVal').textContent = b.usdBudgetActive
        ? money(b.capUsd)
        : (b.includedLimit > 0 ? formatUnits(b.includedLimit) + ' units' : 'Not set');
      document.getElementById('amountLeftVal').textContent = b.usdBudgetActive
        ? money(b.leftUsd)
        : (formatUnits(b.includedRemaining) + ' units');
      document.getElementById('onDemandVal').textContent = b.onDemandEnabled
        ? money(snapshot.onDemandSpendUsd) + (b.onDemandCapUsd ? ' / ' + money(b.onDemandCapUsd) : '')
        : 'Off';
      document.getElementById('teamOnDemandVal').textContent = b.teamOnDemandEnabled
        ? (b.teamOnDemandSpendUsd != null ? money(b.teamOnDemandSpendUsd) : 'On')
        : 'Off';

      const thresholdPill = document.getElementById('thresholdPill');
      thresholdPill.style.display = b.thresholdReached ? 'inline-block' : 'none';
      thresholdPill.textContent = Math.round(threshold) + '% threshold';

      var personalCapRow = document.getElementById('personalCapRow');
      if (personalCapRow) {
        personalCapRow.hidden = !b.usdBudgetActive;
      }
      if (b.usdBudgetActive) {
        document.getElementById('budgetCapBig').textContent = money(b.capUsd);
        document.getElementById('budgetInput').value = snapshot.customBudgetLimit || b.capUsd || '';
      } else {
        var budgetEdit = document.getElementById('budgetEdit');
        if (budgetEdit) budgetEdit.classList.remove('open');
      }

      document.getElementById('resetText').textContent = 'Resets on ' + b.resetDateLabel;
      document.getElementById('cycleRange').textContent = b.cycleStartLabel + ' → ' + b.cycleEndLabel;
      document.getElementById('daysPill').textContent = 'in ' + b.daysUntilReset + ' days';

      const profile = snapshot.profile;
      document.getElementById('planText').textContent =
        (profile?.membershipType || usage.membershipType || local.membershipType || '-') +
        (profile?.isTeamMember ? ' (team)' : '');
      document.getElementById('limitTypeText').textContent = usage.limitType;

      document.getElementById('autoSwitchText').textContent = snapshot.limitExceeded
        ? (snapshot.fallbackApplied ? 'Yes · Composer 2.5' : 'Pending')
        : 'No';

      const chips = (snapshot.features || []).filter(function(f) {
        return f.indexOf('Auto ') !== 0;
      });
      const chipContainer = document.getElementById('featureChips');
      if (chipContainer) {
        chipContainer.replaceChildren();
        chips.forEach(function(f) {
          const chip = document.createElement('span');
          chip.className = 'feature-chip';
          chip.textContent = f;
          chipContainer.appendChild(chip);
        });
      }

      document.getElementById('footerMsg').textContent = b.thresholdReached
        ? (b.usdBudgetActive
          ? 'Spend is at ' + Math.round(gaugeValue) + '% of your personal cap. Consider Composer 2.5 (Fast off).'
          : 'Usage is at ' + Math.round(hero) + '%. Consider Composer 2.5 (Fast off) before hitting the cap.')
        : "You're in control. We'll notify you before you reach your cap.";

      renderSpark(snapshot.history || [], threshold);

      var mascot = document.getElementById('mascotLogo');
      if (mascot) {
        var eyeColor = '#39ff14';
        if (snapshot.limitExceeded) eyeColor = '#7ee787';
        else if (hero >= 100) eyeColor = '#ff6b6b';
        else if (hero >= threshold) eyeColor = '#f5b942';
        else if (hero >= 50) eyeColor = '#5b9dff';
        mascot.style.setProperty('--eye-color', eyeColor);
      }
    }

    function renderCommunityStats(stats) {
      var headline = document.getElementById('communityStatsHeadline');
      var breakdown = document.getElementById('communityStatsBreakdown');
      if (!headline || !breakdown) return;
      if (!stats || !stats.verified || stats.total == null) {
        headline.textContent = 'Community downloads unavailable';
        breakdown.textContent = 'Live marketplace stats did not respond — no placeholder counts shown.';
        return;
      }
      headline.textContent = Number(stats.total).toLocaleString() + ' total downloads across marketplaces';
      var parts = [];
      if (stats.openVsxCombined != null) parts.push('Open VSX ' + Number(stats.openVsxCombined).toLocaleString());
      if (stats.breakdown && stats.breakdown.vscodeMarketplace != null) {
        parts.push('VS Code ' + Number(stats.breakdown.vscodeMarketplace).toLocaleString());
      }
      if (stats.breakdown && stats.breakdown.githubAllAssets != null) {
        parts.push('GitHub ' + Number(stats.breakdown.githubAllAssets).toLocaleString());
      }
      breakdown.textContent = parts.join(' · ');
    }

    function formatBackupBytes(bytes) {
      if (bytes >= 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
      }
      if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      }
      return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    }

    function renderDbBackupStats(stats) {
      var summary = document.getElementById('dbBackupSummary');
      var btn = document.getElementById('recoverDbBackupsBtn');
      var body = document.getElementById('recoverDbBackupsBody');
      if (!summary || !btn) return;
      if (!stats || stats.count === 0) {
        summary.textContent = 'None found';
        btn.disabled = true;
        if (body) {
          body.textContent = 'No stale state.vscdb backup files were found in globalStorage.';
        }
        return;
      }
      summary.textContent = stats.count + ' file(s) · ' + formatBackupBytes(stats.totalBytes);
      btn.disabled = false;
      if (body) {
        body.textContent =
          'Remove ' + stats.count + ' stale backup file(s) (' + formatBackupBytes(stats.totalBytes) + ')? ' +
          'Only state.vscdb.backup-* copies are deleted — your live Cursor database stays intact.';
      }
    }

    window.addEventListener('message', function(event) {
      if (event.data?.type === 'snapshot') render(event.data.payload);
      if (event.data?.type === 'communityDownloads') renderCommunityStats(event.data.payload);
      if (event.data?.type === 'dbBackupStats') renderDbBackupStats(event.data.payload);
      if (event.data?.type === 'subscribeResult') {
        var status = document.getElementById('subscribeStatus');
        var btn = document.getElementById('subscribeBtn');
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('subscribe-btn-loading');
        }
        if (status) {
          status.textContent = event.data.payload?.message || '';
          status.style.color = event.data.payload?.ok ? 'var(--ok)' : 'var(--danger)';
        }
        if (event.data.payload?.ok && event.data.payload?.state) {
          applySubscribeState(event.data.payload.state);
        }
      }
      if (event.data?.type === 'subscribeState') {
        applySubscribeState(event.data.payload);
      }
      if (event.data?.type === 'reindexPolicy') {
        applyReindexPolicy(event.data.payload);
      }
      if (event.data?.type === 'reindexProgress') {
        applyReindexProgress(event.data.payload);
      }
      if (event.data?.type === 'reindexResult') {
        applyReindexResult(event.data.payload);
      }
      if (event.data?.type === 'editorSettings') {
        applyEditorSettingsForm(event.data.payload);
        var settingsStatus = document.getElementById('settingsStatus');
        if (settingsStatus) {
          settingsStatus.textContent = 'Settings saved.';
          settingsStatus.style.color = 'var(--ok)';
        }
      }
    });

    var subscribeModalTimer = null;
    var subscribePromptReady = false;
    var reindexPolicyDisabled = false;

    function setReindexLoading(active, message, current, total) {
      var overlay = document.getElementById('reindexLoader');
      var row = document.getElementById('reindexLoaderRow');
      var spinner = document.getElementById('reindexLoaderSpinner');
      var msg = document.getElementById('reindexLoaderMessage');
      var hint = document.getElementById('reindexLoaderHint');
      var bar = document.getElementById('reindexProgressBar');
      var fill = document.getElementById('reindexProgressFill');
      var actions = document.getElementById('reindexLoaderActions');
      var btn = document.getElementById('reindexBtn');
      if (!overlay) return;
      if (active) {
        overlay.classList.add('visible');
        overlay.setAttribute('aria-hidden', 'false');
        if (row) {
          row.classList.remove('is-done', 'is-error');
        }
        if (spinner) spinner.style.display = '';
        if (actions) actions.hidden = true;
        if (hint) hint.hidden = false;
        if (btn) btn.disabled = true;
      } else {
        overlay.classList.remove('visible');
        overlay.setAttribute('aria-hidden', 'true');
        if (btn) {
          btn.disabled = reindexPolicyDisabled;
          btn.style.opacity = reindexPolicyDisabled ? '0.55' : '1';
        }
        if (bar) bar.hidden = true;
        if (fill) fill.style.width = '0%';
      }
      if (msg && message) msg.textContent = message;
      if (bar && fill && typeof total === 'number' && total > 0) {
        bar.hidden = false;
        var pct = Math.max(4, Math.round(((current || 0) / total) * 100));
        fill.style.width = pct + '%';
      } else if (bar && active) {
        bar.hidden = true;
      }
    }

    function applyReindexProgress(payload) {
      if (!payload || typeof payload !== 'object') return;
      setReindexLoading(true, payload.message || 'Working…', payload.current, payload.total);
    }

    function applyReindexResult(payload) {
      var row = document.getElementById('reindexLoaderRow');
      var spinner = document.getElementById('reindexLoaderSpinner');
      var msg = document.getElementById('reindexLoaderMessage');
      var hint = document.getElementById('reindexLoaderHint');
      var actions = document.getElementById('reindexLoaderActions');
      if (!payload || typeof payload !== 'object') {
        setReindexLoading(false);
        return;
      }
      if (!payload.success) {
        if (row) row.classList.add('is-error');
        if (spinner) spinner.style.display = 'none';
        if (msg) msg.textContent = payload.error || 'Reindex failed.';
        if (hint) hint.hidden = true;
        if (actions) actions.hidden = false;
        return;
      }
      var indexed = Array.isArray(payload.searchIndexed) ? payload.searchIndexed.length : 0;
      var restored = Array.isArray(payload.sidebarRestored) ? payload.sidebarRestored.length : 0;
      var skipped = Array.isArray(payload.skipped) ? payload.skipped.length : 0;
      if (row) row.classList.add('is-done');
      if (spinner) spinner.style.display = 'none';
      if (msg) {
        msg.textContent = indexed || restored
          ? 'Done — indexed ' + indexed + ', restored ' + restored + ' (' + skipped + ' already present).'
          : 'Done — no missing conversations found.';
      }
      if (hint) {
        hint.textContent = 'Reload the window if chats do not appear immediately.';
        hint.hidden = false;
      }
      window.setTimeout(function() { setReindexLoading(false); }, 2600);
    }

    function applyReindexPolicy(policy) {
      var body = document.getElementById('reindexPolicyBody');
      var btn = document.getElementById('reindexBtn');
      if (!policy || typeof policy !== 'object') return;
      if (body) {
        if (policy.reindexEnabled === false) {
          body.textContent = 'Conversation reindex is disabled by Mission Control policy. Contact your admin to re-enable it.';
        } else if (policy.requireEditorQuit) {
          body.innerHTML = 'This rebuilds search indexes and restores orphaned agent chats from Aug 10 onward. <strong>Quit Cursor or VS Code completely</strong> before continuing — live database writes are blocked while the editor is running.';
        } else {
          body.textContent = 'This rebuilds search indexes and restores orphaned agent chats from Aug 10 onward. A backup is created first, then indexes are rebuilt while the editor stays open.';
        }
      }
      if (btn) {
        reindexPolicyDisabled = policy.reindexEnabled === false;
        btn.disabled = reindexPolicyDisabled;
        btn.style.opacity = reindexPolicyDisabled ? '0.55' : '1';
      }
    }

    function applySubscribeState(state) {
      var modal = document.getElementById('subscribeModal');
      if (!modal) return;
      if (!state || !state.showPrompt) {
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
        subscribePromptReady = false;
        if (subscribeModalTimer) {
          clearTimeout(subscribeModalTimer);
          subscribeModalTimer = null;
        }
        return;
      }
      var title = document.getElementById('subscribeTitle');
      var body = document.getElementById('subscribeBody');
      var btn = document.getElementById('subscribeBtn');
      var later = document.getElementById('subscribeLaterBtn');
      if (state.copy) {
        if (title) title.textContent = state.copy.title;
        if (body) body.textContent = state.copy.body;
        if (btn) btn.textContent = state.copy.cta;
        if (later) later.textContent = state.copy.later;
      }
      if (!subscribePromptReady && !subscribeModalTimer) {
        subscribeModalTimer = setTimeout(function() {
          subscribePromptReady = true;
          modal.classList.add('visible');
          modal.setAttribute('aria-hidden', 'false');
          trapSubscribeFocus(modal);
        }, 30000);
      }
    }

    function refresh() { vscode.postMessage({ type: 'refresh' }); }
    onClick('settingsBtn', openSettingsModal);
    onClick('settingsCancelBtn', closeSettingsModal);
    onClick('settingsSaveBtn', function() {
      var status = document.getElementById('settingsStatus');
      if (status) {
        status.textContent = 'Saving…';
        status.style.color = 'var(--muted)';
      }
      vscode.postMessage({ type: 'updateEditorSettings', settings: collectEditorSettingsFromForm() });
    });
    onClick('refreshBtn', refresh);
    onClick('refreshBtn2', refresh);
    onClick('cursorMissingRefresh', refresh);
    onClick('cursorMissingBrowser', function() {
      vscode.postMessage({ type: 'loginWithBrowser' });
    });
    onClick('cursorMissingPaste', function() {
      vscode.postMessage({ type: 'pasteToken' });
    });
    onClick('addAccountBtn', function() {
      vscode.postMessage({ type: 'addAccount' });
    });
    onClick('removeAccountBtn', function() {
      var sel = document.getElementById('accountSelect');
      vscode.postMessage({ type: 'removeAccount', accountId: sel && sel.value ? sel.value : undefined });
    });
    var accountSelect = document.getElementById('accountSelect');
    if (accountSelect) {
      accountSelect.addEventListener('change', function() {
        vscode.postMessage({ type: 'switchAccount', accountId: accountSelect.value });
      });
    }
    onClick('fallbackBtn', function() {
      vscode.postMessage({ type: 'applyFallback' });
    });
    onClick('feedbackBtn', function() {
      vscode.postMessage({ type: 'sendFeedback' });
    });
    onClick('reindexBtn', function() {
      var modal = document.getElementById('reindexModal');
      if (modal) {
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        var confirmBtn = document.getElementById('reindexConfirm');
        if (confirmBtn) confirmBtn.focus();
      }
    });
    onClick('reindexCancel', function() {
      var modal = document.getElementById('reindexModal');
      if (modal) {
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
      }
    });
    onClick('reindexConfirm', function() {
      var modal = document.getElementById('reindexModal');
      if (modal) {
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
      }
      setReindexLoading(true, 'Starting conversation reindex…');
      vscode.postMessage({ type: 'reindexConversations' });
    });
    onClick('reindexLoaderClose', function() {
      setReindexLoading(false);
    });
    onClick('recoverDbBackupsBtn', function() {
      var modal = document.getElementById('recoverDbBackupsModal');
      if (modal) {
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        var confirmBtn = document.getElementById('recoverDbBackupsConfirm');
        if (confirmBtn) confirmBtn.focus();
      }
    });
    onClick('recoverDbBackupsCancel', function() {
      var modal = document.getElementById('recoverDbBackupsModal');
      if (modal) {
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
      }
    });
    onClick('recoverDbBackupsConfirm', function() {
      var modal = document.getElementById('recoverDbBackupsModal');
      if (modal) {
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
      }
      var btn = document.getElementById('recoverDbBackupsBtn');
      if (btn) btn.disabled = true;
      vscode.postMessage({ type: 'recoverDbBackups' });
    });
    function bindCollapse(toggleId) {
      var toggle = document.getElementById(toggleId);
      if (!toggle) return;
      var saved = vscode.getState();
      var key = 'collapse_' + toggleId;
      if (saved && typeof saved[key] === 'boolean') {
        toggle.setAttribute('aria-expanded', saved[key] ? 'true' : 'false');
      }
      toggle.addEventListener('click', function() {
        var expanded = toggle.getAttribute('aria-expanded') !== 'false';
        var next = !expanded;
        toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
        var state = vscode.getState() || {};
        state[key] = next;
        vscode.setState(state);
      });
    }
    bindCollapse('localInsightsToggle');
    bindCollapse('activeModelsToggle');
    bindCollapse('recentSessionsToggle');
    bindCollapse('usageBreakdownToggle');
    onClick('usageHelpBtn', function() {
      var modal = document.getElementById('usageHelpModal');
      if (modal) {
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        var closeBtn = document.getElementById('usageHelpClose');
        if (closeBtn) closeBtn.focus();
      }
    });
    onClick('usageHelpClose', function() {
      var modal = document.getElementById('usageHelpModal');
      if (modal) {
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
      }
    });
    onClick('subscribeBtn', function() {
      var email = document.getElementById('subscribeEmail').value || '';
      var consent = document.getElementById('subscribeConsent');
      var status = document.getElementById('subscribeStatus');
      var btn = document.getElementById('subscribeBtn');
      if (consent && !consent.checked) {
        if (status) {
          status.textContent = 'Please agree to receive product updates.';
          status.style.color = 'var(--danger)';
        }
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.classList.add('subscribe-btn-loading');
      }
      vscode.postMessage({ type: 'subscribeUpdates', email: email });
    });
    onClick('subscribeLaterBtn', function() {
      vscode.postMessage({ type: 'snoozeSubscribe' });
    });
    onClick('subscribeDeclineBtn', function() {
      vscode.postMessage({ type: 'declineSubscribe' });
    });
    vscode.postMessage({ type: 'getSubscribeState' });
    onClick('editBudgetBtn', function() {
      var panel = document.getElementById('budgetEdit');
      var btn = document.getElementById('editBudgetBtn');
      if (!panel) return;
      var open = !panel.classList.contains('open');
      panel.classList.toggle('open', open);
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var input = document.getElementById('budgetInput');
        if (input) input.focus();
      }
    });
    onClick('saveBudgetBtn', function() {
      var value = Number(document.getElementById('budgetInput').value || 0);
      if (!Number.isFinite(value) || value < 0) return;
      vscode.postMessage({ type: 'setBudget', value: value });
      document.getElementById('budgetEdit').classList.remove('open');
    });
    if (bootSnapshot) {
      try { render(bootSnapshot); } catch (e) { dismissLoading(); }
    } else {
      dismissLoading();
    }
    window.addEventListener('message', function(event) {
      if (event.data?.type === 'snapshot') snapshotReceived = true;
    }, { capture: true });
    setTimeout(function() {
      if (!snapshotReceived) {
        var errorBox = document.getElementById('errorBox');
        if (errorBox && errorBox.style.display === 'none') {
          errorBox.style.display = 'block';
          errorBox.textContent = 'Still waiting for usage data. Tap Refresh or reopen the panel.';
        }
      }
    }, 8000);
  </script>
</body>
</html>`;
  }
}

export function serializeWebviewBootSnapshot(snapshot: DashboardSnapshot | undefined): string {
  if (!snapshot) {
    return "null";
  }
  return JSON.stringify(snapshot)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export type StatusBarUsageSource = "plan" | "autoApi" | "both";

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

function statusBarIcon(snapshot: DashboardSnapshot, usagePercent: number): string {
  if (snapshot.error) {
    return "$(warning)";
  }
  if (snapshot.limitExceeded) {
    return "$(pass)";
  }
  if (usagePercent >= (snapshot.budget?.thresholdPercent ?? 80)) {
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
  if (b?.usdBudgetActive) {
    return `Usage: ${pct}% (${money(b.spentUsd)} / ${money(b.capUsd)})`;
  }
  return `Usage: ${pct}%`;
}

function formatAutoApiUsage(snapshot: DashboardSnapshot): string {
  const { auto, api } = autoApiPercents(snapshot);
  const suffix = snapshot.limitExceeded ? " (free)" : "";
  return `Auto ${formatPercent(auto)}% · API ${formatPercent(api)}%${suffix}`;
}

export function formatStatusBarText(
  snapshot: DashboardSnapshot,
  source: StatusBarUsageSource = "plan"
): string {
  if (snapshot.error) {
    return "$(warning) Cursor usage";
  }
  const { auto, api } = autoApiPercents(snapshot);
  const usagePercent =
    source === "plan"
      ? planPercent(snapshot)
      : Math.max(auto, api, source === "both" ? planPercent(snapshot) : 0);
  const icon = statusBarIcon(snapshot, usagePercent);

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
  const lines: string[] = [];
  if (snapshot.email) {
    lines.push(`Login: ${snapshot.email}`);
  }
  lines.push(
    `Plan: ${Math.round(planPct)}%`,
    `Auto: ${formatPercent(auto)}%`,
    `API: ${formatPercent(api)}%`
  );
  const b = snapshot.budget;
  if (b?.usdBudgetActive) {
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
