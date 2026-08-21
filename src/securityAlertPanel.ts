import * as vscode from "vscode";
import type { SecurityFinding } from "@lorapok/cursor-monitor-shared";
import { escapeHtml } from "./htmlEscape";
import { generateNonce } from "./utils";

const PANEL_TYPE = "cursorCurseMonitor.securityAlert";

function kindLabel(kind: SecurityFinding["kind"]): string {
  const map: Record<SecurityFinding["kind"], string> = {
    api_key: "API key",
    bearer_token: "Bearer token",
    password: "Password / secret",
    private_key: "Private key",
    jwt: "JWT",
    email_credential: "Account credential",
  };
  return map[kind] ?? kind;
}

function parseFindingTarget(f: SecurityFinding): { file: string; line: number } {
  const line = f.line ?? 1;
  if (f.line && f.location.endsWith(`:${f.line}`)) {
    return { file: f.location.slice(0, -(`${f.line}`.length + 1)), line };
  }
  return { file: f.location, line };
}

export class SecurityAlertPanel {
  private static panel: vscode.WebviewPanel | undefined;

  static show(
    context: vscode.ExtensionContext,
    findings: SecurityFinding[]
  ): void {
    if (!findings.length) return;

    if (!SecurityAlertPanel.panel) {
      SecurityAlertPanel.panel = vscode.window.createWebviewPanel(
        PANEL_TYPE,
        "Security Alert",
        vscode.ViewColumn.Beside,
        { enableScripts: true }
      );
      SecurityAlertPanel.panel.onDidDispose(() => {
        SecurityAlertPanel.panel = undefined;
      });
      SecurityAlertPanel.panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === "open" && msg.file) {
          const line = Number(msg.line) || 1;
          try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(String(msg.file)));
            const editor = await vscode.window.showTextDocument(doc);
            const pos = new vscode.Position(Math.max(0, line - 1), 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos));
          } catch {
            void vscode.window.showErrorMessage(`Could not open file: ${msg.file}`);
          }
        }
        if (msg.type === "dismiss") {
          SecurityAlertPanel.panel?.dispose();
        }
      });
    }

    SecurityAlertPanel.panel.webview.html = SecurityAlertPanel.getHtml(findings);
    SecurityAlertPanel.panel.reveal(vscode.ViewColumn.Beside);
  }

  private static getHtml(findings: SecurityFinding[]): string {
    const nonce = generateNonce();
    const rows = findings
      .map(
        (f) => `
      <tr class="row ${f.severity}">
        <td>${escapeHtml(f.location)}</td>
        <td>${escapeHtml(kindLabel(f.kind))}</td>
        <td>${escapeHtml(f.severity)}</td>
        <td><code>${escapeHtml(f.snippet)}</code></td>
      </tr>`
      )
      .join("");

    const first = findings[0];
    const target = first ? parseFindingTarget(first) : { file: "", line: 1 };
    const openPayload = JSON.stringify(target).replace(/</g, "\\u003c");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    :root {
      --bg: #1a1b1e;
      --surface: #25262b;
      --border: #373a40;
      --text: #f1f5fb;
      --muted: #909296;
      --danger: #f87171;
      --danger-bg: rgba(248, 113, 113, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 20px;
      font-size: 13px;
    }
    .modal {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      overflow: hidden;
      max-width: 520px;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    .head h1 { margin: 0; font-size: 14px; font-weight: 600; }
    .close {
      background: none; border: none; color: var(--muted);
      font-size: 18px; cursor: pointer; line-height: 1;
    }
    .body { padding: 14px 16px; color: var(--muted); line-height: 1.5; }
    .table-wrap {
      margin: 12px 16px 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      text-align: left;
      padding: 8px 10px;
      color: var(--muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.06em;
      border-bottom: 1px solid var(--border);
      background: #2c2e33;
    }
    td { padding: 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
    tr.row.high { background: var(--danger-bg); }
    tr:last-child td { border-bottom: none; }
    code { font-family: ui-monospace, monospace; font-size: 11px; }
    .foot {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 16px 16px;
    }
    .btn {
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-weight: 600;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-danger { background: var(--danger); color: #1a1b1e; }
    .btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); }
    .note { font-size: 11px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="modal">
    <div class="head">
      <h1>Security Alert</h1>
      <button class="close" id="dismissX" aria-label="Close">×</button>
    </div>
    <div class="body">
      Sensitive credentials were detected. Remove or rotate them before sharing or committing.
      <p class="note">Secrets pasted only into Cursor chat (never saved to disk) cannot be scanned.</p>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Location</th><th>Type</th><th>Risk</th><th>Preview</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="foot">
      <button class="btn btn-ghost" id="dismissBtn">Dismiss</button>
      <button class="btn btn-danger" id="reviewBtn">Review finding</button>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const target = ${openPayload};
    document.getElementById('reviewBtn').onclick = () => vscode.postMessage({ type: 'open', file: target.file, line: target.line });
    document.getElementById('dismissBtn').onclick = () => vscode.postMessage({ type: 'dismiss' });
    document.getElementById('dismissX').onclick = () => vscode.postMessage({ type: 'dismiss' });
  </script>
</body>
</html>`;
  }
}
