import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";

type NotificationType = "info" | "warning" | "error" | "success";

interface NotificationOptions {
  title?: string;
  message: string;
  type?: NotificationType;
  duration?: number;
  actions?: Array<{ label: string; action: () => void }>;
  customIcon?: string;
}

export class NotificationProvider {
  private static panel: vscode.WebviewPanel | undefined;
  private static disposables: vscode.Disposable[] = [];
  private static extensionUri: vscode.Uri;

  static setExtensionUri(uri: vscode.Uri): void {
    this.extensionUri = uri;
  }

  static show(options: NotificationOptions): void {
    const {
      title = "Cursor Curse Monitor",
      message,
      type = "info",
      duration = 5000,
      actions = [],
      customIcon,
    } = options;

    // Close existing panel if open
    if (this.panel) {
      this.panel.dispose();
    }

    // Create new panel
    this.panel = vscode.window.createWebviewPanel(
      "cursorCurseMonitor.notification",
      "Notification",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
      }
    );

    const iconSvg = customIcon ? this.getCustomIconSvg(customIcon) : this.getIconSvg(type);
    this.panel.webview.html = this.getHtml(title, message, type, actions, iconSvg, this.panel.webview);

    // Auto-close after duration
    const timeout = setTimeout(() => {
      this.panel?.dispose();
    }, duration);

    this.disposables.push(
      new vscode.Disposable(() => clearTimeout(timeout)),
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      })
    );

    // Handle actions
    this.panel.webview.onDidReceiveMessage((message) => {
      if (message.type === "action") {
        const action = actions.find((a) => a.label === message.label);
        if (action) {
          action.action();
        }
        this.panel?.dispose();
      }
    });
  }

  private static getHtml(
    title: string,
    message: string,
    type: NotificationType,
    actions: Array<{ label: string; action: () => void }>,
    iconSvg: string,
    webview: vscode.Webview
  ): string {
    const colors = {
      info: { primary: "#5b9dff", secondary: "#7c5cff", bg: "rgba(91, 157, 255, 0.1)" },
      warning: { primary: "#f5b942", secondary: "#ff9f43", bg: "rgba(245, 185, 66, 0.1)" },
      error: { primary: "#ff6b6b", secondary: "#ff8787", bg: "rgba(255, 107, 107, 0.1)" },
      success: { primary: "#00ff88", secondary: "#39ff14", bg: "rgba(0, 255, 136, 0.1)" },
    };

    const theme = colors[type];

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notification</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      background: #0f1117;
      color: #eef2fb;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }
    .notification {
      background: linear-gradient(135deg, #1a1f28, #0d1117);
      border: 1px solid ${theme.primary};
      border-radius: 16px;
      padding: 24px;
      max-width: 400px;
      box-shadow: 0 0 30px ${theme.bg}, 0 0 60px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.3s ease-out;
    }
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .notification-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .icon-container {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      background: linear-gradient(135deg, ${theme.primary}, ${theme.secondary});
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 20px ${theme.bg};
      overflow: hidden;
    }
    .icon-container svg {
      width: 100%;
      height: 100%;
    }
    .title {
      font-size: 16px;
      font-weight: 700;
      color: ${theme.primary};
    }
    .message {
      font-size: 14px;
      line-height: 1.6;
      color: #8b96ad;
      margin-bottom: 20px;
    }
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .action-btn {
      padding: 10px 16px;
      border-radius: 8px;
      border: 1px solid ${theme.primary};
      background: transparent;
      color: ${theme.primary};
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .action-btn:hover {
      background: ${theme.bg};
      transform: translateY(-2px);
      box-shadow: 0 4px 12px ${theme.bg};
    }
    .action-btn.primary {
      background: linear-gradient(135deg, ${theme.primary}, ${theme.secondary});
      color: #0d1117;
      border-color: transparent;
    }
    .action-btn.primary:hover {
      background: linear-gradient(135deg, ${theme.secondary}, ${theme.primary});
    }
    .progress-bar {
      height: 3px;
      background: #2a3040;
      border-radius: 999px;
      overflow: hidden;
      margin-top: 16px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, ${theme.primary}, ${theme.secondary});
      animation: progress 5s linear forwards;
    }
    @keyframes progress {
      from { width: 100%; }
      to { width: 0%; }
    }
  </style>
</head>
<body>
  <div class="notification">
    <div class="notification-header">
      <div class="icon-container">
        ${iconSvg}
      </div>
      <div class="title">${title}</div>
    </div>
    <div class="message">${message}</div>
    ${actions.length > 0 ? `
    <div class="actions">
      ${actions.map((action, i) => `
        <button class="action-btn ${i === 0 ? 'primary' : ''}" data-label="${action.label}">
          ${action.label}
        </button>
      `).join('')}
    </div>
    ` : ''}
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'action', label: btn.dataset.label });
      });
    });
  </script>
</body>
</html>`;
  }

  static dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    if (this.panel) {
      this.panel.dispose();
    }
  }

  private static getIconSvg(type: NotificationType): string {
    const iconFiles = {
      info: "notification-info.svg",
      warning: "notification-warning.svg",
      error: "notification-error.svg",
      success: "notification-success.svg",
    };

    const iconPath = path.join(this.extensionUri.fsPath, "media", iconFiles[type]);
    try {
      return fs.readFileSync(iconPath, "utf8");
    } catch (error) {
      console.error(error);
      return "";
    }
  }

  private static getCustomIconSvg(iconFile: string): string {
    const iconPath = path.join(this.extensionUri.fsPath, "media", iconFile);
    try {
      return fs.readFileSync(iconPath, "utf8");
    } catch (error) {
      console.error(error);
      return "";
    }
  }
}
