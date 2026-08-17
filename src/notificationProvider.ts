import * as vscode from "vscode";

type NotificationType = "info" | "warning" | "error" | "success";

interface NotificationOptions {
  title?: string;
  message: string;
  type?: NotificationType;
  duration?: number;
  actions?: Array<{ label: string; action: () => void }>;
  customIcon?: string;
}

function showNative(
  type: NotificationType,
  text: string,
  items: string[]
): Thenable<string | undefined> {
  if (type === "warning") {
    return vscode.window.showWarningMessage(text, ...items);
  }
  if (type === "error") {
    return vscode.window.showErrorMessage(text, ...items);
  }
  return vscode.window.showInformationMessage(text, ...items);
}

/**
 * Native workbench toasts that overlay the open editor.
 * Does not open a webview tab.
 */
export class NotificationProvider {
  static setExtensionUri(_uri: vscode.Uri): void {
    // Kept for call-site compatibility; native toasts do not need media URIs.
  }

  static show(options: NotificationOptions): void {
    const { title, message, type = "info", actions = [] } = options;
    const text = title
      ? `Cursor Curse Monitor — ${title}: ${message}`
      : `Cursor Curse Monitor — ${message}`;
    const runnable = actions.filter((action) => action.label !== "Dismiss");
    const items = runnable.map((action) => action.label);

    void showNative(type, text, items).then((picked) => {
      if (!picked) {
        return;
      }
      const action = runnable.find((item) => item.label === picked);
      action?.action();
    });
  }

  static dispose(): void {
    // Native toasts are owned by the workbench.
  }
}
