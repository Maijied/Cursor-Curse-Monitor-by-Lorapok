import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { DashboardSnapshot, formatPercent } from "./cursorApi";
import { UsageMonitorService } from "./usageMonitor";
import { generateNonce } from "./utils";
import { subscribeForProductUpdates, getSubscribePromptViewState, snoozeSubscribePrompt, declineSubscribePrompt } from "./updateSubscription";
import {
  SUPPORTED_IDE_WRAPPERS,
  SUPPORTED_IDE_WRAPPERS_HEADLINE,
  SUPPORTED_IDE_WRAPPERS_SUBLINE,
} from "@lorapok/cursor-monitor-shared";

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

    const deliverSnapshot = async (force = false) => {
      if (latestSnapshot) {
        push(latestSnapshot);
      }
      const cached = this.monitor.getSnapshot();
      if (cached) {
        push(cached);
      }
      try {
        push(await this.monitor.refresh(force));
      } catch {
        const fallback = this.monitor.getSnapshot();
        if (fallback) {
          push(fallback);
        }
      }
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
    webviewView.webview.onDidReceiveMessage(async (message: { type: string; value?: number; email?: string }) => {
      if (message.type === "ready") {
        if (viewReady) {
          return;
        }
        viewReady = true;
        await deliverSnapshot(false);
        return;
      }
      if (message.type === "refresh") {
        await deliverSnapshot(false);
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
      if (message.type === "reindexConversations") {
        await vscode.commands.executeCommand("cursorCurseMonitor.reindexConversations");
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
      serializeWebviewBootSnapshot(latestSnapshot)
    );
  }

  private getHtml(
    logoSvg: string,
    usageMeterSvg: string,
    cspSource: string,
    extensionVersion: string,
    nonce: string,
    iconUri: string,
    bootJson: string
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
      width: 100%;
      margin: 0 0 12px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--panel);
      color: var(--muted);
      font: inherit;
      font-size: 12px;
      letter-spacing: 0.02em;
      cursor: default;
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
    .header-actions { display: flex; gap: 6px; align-items: center; }
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
    .icon-btn:focus-visible,
    button:focus-visible,
    a:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--accent-2);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .fill, .meter-fill, .logo-wrap { transition: none !important; }
      .subscribe-btn-loading::after { animation: none !important; }
    }
    .connected {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-top: 6px;
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
    .footer-left { display: flex; align-items: center; gap: 6px; color: var(--muted); flex-wrap: wrap; }
    .footer-left a { color: var(--accent-2); text-decoration: none; font-weight: 600; font-size: 11px; }
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
    body.cursor-missing #refreshBtn2 {
      pointer-events: auto;
      opacity: 1;
    }
  </style>
</head>
<body>
  <button type="button" id="loadingState" class="loading-state" disabled aria-live="polite">Loading dashboard…</button>
  <div id="cursorMissingOverlay" class="cursor-missing-overlay" role="alertdialog" aria-modal="true" aria-labelledby="cursorMissingTitle" aria-live="polite">
    <div class="cursor-missing-card">
      <p class="cursor-missing-eyebrow">No Cursor AI found</p>
      <h2 id="cursorMissingTitle" style="margin:0 0 8px;font-size:18px;">Cursor is not installed or not signed in</h2>
      <p style="margin:0 0 14px;color:var(--muted);font-size:12px;line-height:1.55;">
        Install or open <strong>Cursor</strong> (or another supported VS Code–based AI IDE), sign in once, then refresh this dashboard.
      </p>
      <p style="margin:0 0 14px;color:var(--muted);font-size:11px;line-height:1.5;">
        Explore more Lorapok Labs tools at
        <a href="https://lorapok.tech" target="_blank" rel="noopener" style="color:var(--accent-2);font-weight:600">lorapok.tech</a>.
      </p>
      <button type="button" class="primary" id="cursorMissingRefresh" style="width:100%;max-width:240px">Refresh after opening Cursor</button>
    </div>
  </div>
  <header class="header">
    <div class="logo-wrap" id="mascotLogo">${logoSvg}</div>
    <div class="header-text">
      <h1>Usage Dashboard</h1>
      <p id="subtitle">Monitor your API usage and manage your budget.</p>
      <span class="connected" id="connBadge">Connected</span>
    </div>
    <div class="header-actions">
      <button type="button" class="icon-btn" id="refreshBtn" title="Refresh" aria-label="Refresh dashboard">↻</button>
    </div>
  </header>

  <div id="errorBox" class="card error" style="display:none"></div>

  <section class="card" id="usageCard">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <p class="section-label" style="margin:0;">
        <span style="display:inline-block; width:16px; height:16px; vertical-align:middle;">${usageMeterSvg}</span>
        Included quota
      </p>
      <span id="statusPill" class="pill ok">OK</span>
    </div>
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
    <div class="row" id="bonusRow" style="display:none">
      <span class="label">Included + bonus</span>
      <span class="value" id="bonusValue">—</span>
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
            <div class="k">Team on-demand</div>
            <div class="v" id="teamOnDemandVal">—</div>
          </div>
        </div>
      </div>
    </div>
    <div class="row" style="margin-top:12px">
      <div>
        <div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Personal cap</div>
        <div id="budgetCapBig" style="font-size:18px;font-weight:700;margin-top:2px">$0.00</div>
        <div class="usage-sub" style="margin:0">USD · optional limit</div>
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

  <section class="card">
    <p class="section-label">Local insights</p>
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
    <div class="muted" style="font-size:10px;margin-bottom:6px">Active models</div>
    <div class="model-list" id="modelList"><div class="muted">No local model data</div></div>
    <div class="muted" style="font-size:10px;margin:12px 0 6px">Recent sessions</div>
    <div class="session-list" id="sessionList"><div class="muted">No recent sessions</div></div>
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
  </section>

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
      <a href="mailto:cursor.monitor@lorapok.tech">Updates</a>
    </div>
    <div class="footer-right">v${esc(extensionVersion)}</div>
  </footer>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const bootSnapshot = ${bootJson};

    function dismissLoading() {
      var loading = document.getElementById('loadingState');
      if (loading) loading.remove();
    }

    function signalReady() {
      vscode.postMessage({ type: 'ready' });
    }

    var subscribeModalTimer = null;
    var subscribePromptReady = false;
    var snapshotReceived = Boolean(bootSnapshot);

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

    // Register before ready signals — on some hosts the extension answers synchronously.
    window.addEventListener('message', function(event) {
      if (event.data?.type === 'snapshot') {
        snapshotReceived = true;
        render(event.data.payload);
      }
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
    });

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

    function render(snapshot) {
      const loading = document.getElementById('loadingState');
      if (loading) loading.remove();
      const b = snapshot.budget;
      const usage = snapshot.usage;
      const errorBox = document.getElementById('errorBox');
      const missingOverlay = document.getElementById('cursorMissingOverlay');
      if (snapshot.cursorMissing) {
        document.body.classList.add('cursor-missing');
        if (missingOverlay) missingOverlay.classList.add('visible');
      } else {
        document.body.classList.remove('cursor-missing');
        if (missingOverlay) missingOverlay.classList.remove('visible');
      }

      const local = snapshot.local || {};
      const teamBit = local.teamName ? ' · ' + local.teamName : '';
      document.getElementById('subtitle').textContent = (snapshot.email ? snapshot.email + teamBit + ' · ' : '') +
        'Lorapok Labs · ' + new Date(snapshot.fetchedAt).toLocaleTimeString();

      if (snapshot.error) {
        errorBox.style.display = 'block';
        errorBox.textContent = snapshot.error;
        document.getElementById('connBadge').style.display = 'none';
      } else {
        errorBox.style.display = 'none';
        document.getElementById('connBadge').style.display = 'inline-flex';
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
      document.getElementById('todayAccepted').textContent = today
        ? todayAcc + ' / ' + todaySug + ' lines'
        : '—';
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
        renderSpark(snapshot.history || [], 80);
        return;
      }

      const hero = b.percentUsed;
      const threshold = b.thresholdPercent;
      document.getElementById('thresholdLine').style.left = threshold + '%';
      document.getElementById('usageBig').textContent = Math.round(hero) + '%';
      document.getElementById('usageSub').textContent = 'of included quota used';

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

      document.getElementById('usedValue').textContent = b.includedUsed + ' / ' + b.includedLimit + ' units';
      document.getElementById('remainingValue').textContent = b.includedRemaining + ' units';
      if (b.planBreakdownBonus > 0) {
        document.getElementById('bonusRow').style.display = 'flex';
        document.getElementById('bonusValue').textContent =
          b.planBreakdownIncluded + ' + ' + b.planBreakdownBonus;
      } else {
        document.getElementById('bonusRow').style.display = 'none';
      }

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
      document.getElementById('budgetCapVal').textContent = b.hasUsdBudget ? money(b.capUsd) : 'Not set';
      document.getElementById('amountLeftVal').textContent = b.hasUsdBudget ? money(b.leftUsd) : (b.includedRemaining + ' u');
      document.getElementById('onDemandVal').textContent = b.onDemandEnabled
        ? money(snapshot.onDemandSpendUsd) + (b.onDemandCapUsd ? ' / ' + money(b.onDemandCapUsd) : '')
        : 'Off';
      document.getElementById('teamOnDemandVal').textContent = b.teamOnDemandEnabled
        ? (b.teamOnDemandSpendUsd != null ? money(b.teamOnDemandSpendUsd) : 'On')
        : 'Off';

      const thresholdPill = document.getElementById('thresholdPill');
      thresholdPill.style.display = b.thresholdReached ? 'inline-block' : 'none';
      thresholdPill.textContent = Math.round(threshold) + '% threshold';

      document.getElementById('budgetCapBig').textContent = money(snapshot.customBudgetLimit || 0);
      document.getElementById('budgetInput').value = snapshot.customBudgetLimit || '';

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
        ? 'Usage is at ' + Math.round(hero) + '%. Consider Composer 2.5 (Fast off) before hitting the cap.'
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

    function refresh() { vscode.postMessage({ type: 'refresh' }); }
    onClick('refreshBtn', refresh);
    onClick('refreshBtn2', refresh);
    onClick('cursorMissingRefresh', refresh);
    onClick('fallbackBtn', function() {
      vscode.postMessage({ type: 'applyFallback' });
    });
    onClick('reindexBtn', function() {
      vscode.postMessage({ type: 'reindexConversations' });
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
      document.getElementById('budgetEdit').classList.toggle('open');
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
    setTimeout(function() {
      if (!snapshotReceived) {
        var errorBox = document.getElementById('errorBox');
        var loading = document.getElementById('loadingState');
        if (loading) {
          loading.disabled = false;
          loading.textContent = 'Still loading… click to refresh';
          loading.addEventListener('click', refresh);
        }
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
  const lines = [
    `Plan: ${Math.round(planPct)}%`,
    `Auto: ${formatPercent(auto)}%`,
    `API: ${formatPercent(api)}%`,
  ];
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
