import * as vscode from "vscode";
import {
  submitProductFeedback,
  type FeedbackKind,
  SUPPORT_EMAIL,
} from "@lorapok/cursor-monitor-shared";
import { escapeHtml } from "./htmlEscape";
import { generateNonce } from "./utils";

const PANEL_TYPE = "cursorCurseMonitor.feedback";

function editorLabel(): string {
  const app = vscode.env.appName || "VS Code";
  const host = vscode.env.uiKind === vscode.UIKind.Web ? " (web)" : "";
  return `${app}${host} ${vscode.version}`;
}

export class FeedbackPanel {
  private static panel: vscode.WebviewPanel | undefined;

  static show(context: vscode.ExtensionContext, initialKind: FeedbackKind = "general"): void {
    const version = String(context.extension.packageJSON.version ?? "0.0.0");

    if (!FeedbackPanel.panel) {
      FeedbackPanel.panel = vscode.window.createWebviewPanel(
        PANEL_TYPE,
        "Send feedback",
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      FeedbackPanel.panel.onDidDispose(() => {
        FeedbackPanel.panel = undefined;
      });
      FeedbackPanel.panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === "close") {
          FeedbackPanel.panel?.dispose();
          return;
        }
        if (msg.type === "submit") {
          const kind = String(msg.kind ?? "general") as FeedbackKind;
          const message = String(msg.message ?? "").trim();
          const email = String(msg.email ?? "").trim();
          if (message.length < 8) {
            void FeedbackPanel.panel?.webview.postMessage({
              type: "status",
              ok: false,
              text: "Please write at least a few words.",
            });
            return;
          }
          void FeedbackPanel.panel?.webview.postMessage({ type: "status", ok: true, text: "Sending…" });
          const result = await submitProductFeedback({
            kind,
            message,
            source: "ide-extension",
            version,
            editor: editorLabel(),
            email: email || null,
          });
          if (!result.ok) {
            void FeedbackPanel.panel?.webview.postMessage({
              type: "status",
              ok: false,
              text: result.error || "Could not send feedback.",
            });
            return;
          }
          void FeedbackPanel.panel?.webview.postMessage({
            type: "status",
            ok: true,
            text: result.warning || result.message || "Thanks — feedback sent!",
          });
          setTimeout(() => FeedbackPanel.panel?.dispose(), 1200);
        }
      });
    }

    FeedbackPanel.panel.webview.html = FeedbackPanel.getHtml(initialKind, version, SUPPORT_EMAIL);
    FeedbackPanel.panel.reveal(vscode.ViewColumn.Active);
  }

  private static getHtml(kind: FeedbackKind, version: string, supportEmail: string): string {
    const nonce = generateNonce();
    const options = [
      { value: "bug", label: "Bug report" },
      { value: "feature", label: "Feature request" },
      { value: "general", label: "General feedback" },
    ]
      .map(
        (opt) =>
          `<option value="${opt.value}"${opt.value === kind ? " selected" : ""}>${escapeHtml(opt.label)}</option>`
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 20px; }
    h1 { font-size: 1.1rem; margin: 0 0 8px; }
    p { margin: 0 0 12px; color: var(--vscode-descriptionForeground); font-size: 0.9rem; line-height: 1.45; }
    label { display: block; font-size: 0.8rem; margin-bottom: 12px; }
    select, textarea, input { width: 100%; box-sizing: border-box; margin-top: 6px; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); font: inherit; }
    textarea { min-height: 120px; resize: vertical; }
    .actions { display: flex; gap: 8px; margin-top: 14px; }
    button { border: none; border-radius: 6px; padding: 8px 14px; font: inherit; cursor: pointer; }
  .primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .ghost { background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-input-border); }
    #status { margin-top: 10px; font-size: 0.85rem; min-height: 1.2em; }
    .meta { font-size: 0.75rem; opacity: 0.8; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>Send feedback</h1>
  <p>Delivered to the community Discord and Mission Control logs. Fallback: <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a></p>
  <label>Type
    <select id="kind">${options}</select>
  </label>
  <label>Message
    <textarea id="message" placeholder="What happened? What would you like improved?"></textarea>
  </label>
  <label>Email (optional)
    <input id="email" type="email" placeholder="you@example.com" autocomplete="email" />
  </label>
  <div class="actions">
    <button class="primary" id="send">Send to Discord</button>
    <button class="ghost" id="close">Cancel</button>
  </div>
  <div id="status"></div>
  <p class="meta">v${escapeHtml(version)} · ${escapeHtml(editorLabel())}</p>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const status = document.getElementById("status");
    document.getElementById("close").addEventListener("click", () => vscode.postMessage({ type: "close" }));
    document.getElementById("send").addEventListener("click", () => {
      vscode.postMessage({
        type: "submit",
        kind: document.getElementById("kind").value,
        message: document.getElementById("message").value,
        email: document.getElementById("email").value,
      });
    });
    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (msg?.type !== "status") return;
      status.textContent = msg.text || "";
      status.style.color = msg.ok ? "var(--vscode-testing-iconPassed)" : "var(--vscode-errorForeground)";
    });
  </script>
</body>
</html>`;
  }
}
