import * as vscode from "vscode";
import { applyComposerFallbackModel } from "./cursorAuth";
import {
  DashboardViewProvider,
  formatStatusBarText,
} from "./dashboardView";
import { UsageMonitorService } from "./usageMonitor";

let monitor: UsageMonitorService | undefined;

export function activate(context: vscode.ExtensionContext): void {
  monitor = new UsageMonitorService(context);
  monitor.start();

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
    statusBar.text = formatStatusBarText(snapshot);
    statusBar.tooltip = snapshot.error
      ? snapshot.error
      : `Cursor usage: ${snapshot.usage?.individualUsage.plan.totalPercentUsed ?? 0}%`;
    statusBar.show();
  };

  monitor.onDidUpdate(() => updateStatusBar());
  updateStatusBar();

  context.subscriptions.push(
    statusBar,
    vscode.window.registerWebviewViewProvider(
      DashboardViewProvider.viewType,
      new DashboardViewProvider(monitor)
    ),
    vscode.commands.registerCommand("cursorCurseMonitor.openDashboard", async () => {
      await vscode.commands.executeCommand(
        "workbench.view.extension.cursor-curse-monitor-lorapok"
      );
    }),
    vscode.commands.registerCommand("cursorCurseMonitor.refresh", async () => {
      await monitor?.refresh();
      void vscode.window.showInformationMessage("Cursor usage refreshed.");
    }),
    vscode.commands.registerCommand(
      "cursorCurseMonitor.applyFallbackModel",
      async () => {
        const wasmPath = vscode.Uri.joinPath(
          context.extensionUri,
          "media",
          "sql-wasm.wasm"
        ).fsPath;
        const applied = await applyComposerFallbackModel(wasmPath);
        if (applied) {
          void vscode.window.showInformationMessage(
            "Applied Composer 2.5 (Fast off) fallback model."
          );
        } else {
          void vscode.window.showInformationMessage(
            "Fallback model already set or Cursor state DB not found."
          );
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
