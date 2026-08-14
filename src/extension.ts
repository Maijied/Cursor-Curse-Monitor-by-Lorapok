import * as vscode from "vscode";
import { applyComposerFallbackModel } from "./cursorAuth";
import {
  DashboardViewProvider,
  formatStatusBarText,
  formatStatusBarTooltip,
  StatusBarUsageSource,
} from "./dashboardView";
import { UsageMonitorService } from "./usageMonitor";
import { NotificationProvider } from "./notificationProvider";

let monitor: UsageMonitorService | undefined;

export function activate(context: vscode.ExtensionContext): void {
  NotificationProvider.setExtensionUri(context.extensionUri);
  monitor = new UsageMonitorService(context);
  monitor.start();

  // Show welcome message on first installation
  const isFirstInstall = !context.globalState.get<boolean>("hasShownWelcome", false);
  if (isFirstInstall) {
    void context.globalState.update("hasShownWelcome", true);
    setTimeout(() => {
      NotificationProvider.show({
        title: "Welcome to Cursor Curse Monitor",
        message: "Thank you for installing! This extension from Lorapok Labs helps you monitor your Cursor AI usage, manage budgets, and automatically switch to free fallback models when you reach limits. Click below to open your dashboard.",
        type: "info",
        duration: 8000,
        customIcon: "welcome-animation.svg",
        actions: [
          {
            label: "Open Dashboard",
            action: () => void vscode.commands.executeCommand("cursorCurseMonitor.openDashboard"),
          },
          { label: "Dismiss", action: () => {} },
        ],
      });
    }, 1500);
  }

  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBar.command = "cursorCurseMonitor.openDashboard";

  const updateStatusBar = () => {
    const config = vscode.workspace.getConfiguration("cursorCurseMonitor");
    if (!config.get<boolean>("showStatusBar", true)) {
      statusBar.hide();
      return;
    }
    const snapshot = monitor?.getSnapshot();
    if (!snapshot) {
      statusBar.text = "$(sync~spin) Cursor usage";
      statusBar.show();
      return;
    }
    const source = config.get<StatusBarUsageSource>("statusBarUsageSource", "autoApi");
    statusBar.text = formatStatusBarText(snapshot, source);
    statusBar.tooltip = formatStatusBarTooltip(snapshot);
    statusBar.show();
  };

  monitor.onDidUpdate(() => updateStatusBar());
  updateStatusBar();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("cursorCurseMonitor.showStatusBar") ||
        event.affectsConfiguration("cursorCurseMonitor.statusBarUsageSource")
      ) {
        updateStatusBar();
      }
    }),
    statusBar,
    vscode.window.registerWebviewViewProvider(
      DashboardViewProvider.viewType,
      new DashboardViewProvider(monitor, context.extensionUri)
    ),
    vscode.commands.registerCommand("cursorCurseMonitor.openDashboard", async () => {
      await vscode.commands.executeCommand(
        "workbench.view.extension.cursor-curse-monitor-lorapok"
      );
    }),
    vscode.commands.registerCommand("cursorCurseMonitor.refresh", async () => {
      await monitor?.refresh();
      NotificationProvider.show({
        title: "Refreshed",
        message: "Cursor usage data has been refreshed.",
        type: "info",
        duration: 3000,
      });
    }),
    vscode.commands.registerCommand(
      "cursorCurseMonitor.applyFallbackModel",
      async () => {
        const wasmPath = vscode.Uri.joinPath(
          context.extensionUri,
          "media",
          "sql-wasm.wasm"
        ).fsPath;
        const result = await applyComposerFallbackModel(wasmPath);
        if (result.success) {
          NotificationProvider.show({
            title: "Fallback Applied",
            message: "Applied Composer 2.5 (Fast off) fallback model.",
            type: "success",
            duration: 4000,
          });
        } else {
          NotificationProvider.show({
            title: "Fallback Failed",
            message: result.error || "Fallback model already set or Cursor state DB not found.",
            type: "error",
            duration: 5000,
          });
        }
        await monitor?.refresh();
      }
    ),
    monitor
  );
}

export function deactivate(): void {
  monitor?.dispose();
  monitor = undefined;
}
