import * as vscode from "vscode";
import { applyComposerFallbackModel } from "./cursorAuth";
import { reindexMissingConversations } from "./conversationReindex";
import {
  DashboardViewProvider,
  formatStatusBarText,
  formatStatusBarTooltip,
  StatusBarUsageSource,
} from "./dashboardView";
import { UsageMonitorService } from "./usageMonitor";
import { NotificationProvider } from "./notificationProvider";
import { maybeShowProductNotice, refreshProductNotice } from "./productNotices";
import { maybeSendAnonymousHeartbeat, startAnonymousHeartbeatScheduler } from "./telemetry";
import { subscribeForProductUpdates, maybeShowSubscribePrompt, snoozeSubscribePrompt, getSubscribePromptViewState } from "./updateSubscription";
import { SUBSCRIBE_PROMPT_DELAY_MS } from "@lorapok/cursor-monitor-shared";
import { readCachedAccountEmail } from "./cursorAuth";
import { SecurityMonitorService } from "./securityMonitor";

let monitor: UsageMonitorService | undefined;
let securityMonitor: SecurityMonitorService | undefined;

export function activate(context: vscode.ExtensionContext): void {
  monitor = new UsageMonitorService(context);
  monitor.start();

  securityMonitor = new SecurityMonitorService(context);
  securityMonitor.start();

  const extensionVersion = String(context.extension.packageJSON.version ?? "0.0.0");
  context.subscriptions.push(startAnonymousHeartbeatScheduler(context, extensionVersion));
  void maybeShowProductNotice(context);
  const noticeInterval = setInterval(() => {
    void maybeShowProductNotice(context);
  }, 6 * 60 * 60 * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(noticeInterval) });
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("cursorCurseMonitor.anonymousUsageStats")) {
        void maybeSendAnonymousHeartbeat(context, extensionVersion);
      }
      if (event.affectsConfiguration("cursorCurseMonitor.productNotices")) {
        void refreshProductNotice(context);
      }
    })
  );

  const isFirstInstall = !context.globalState.get<boolean>("hasShownWelcome", false);
  if (isFirstInstall) {
    void context.globalState.update("hasShownWelcome", true);
    setTimeout(() => {
      void getSubscribePromptViewState(context).then((promptState) => {
        const actions: Array<{ label: string; action: () => void }> = [
          {
            label: "Open Dashboard",
            action: () => void vscode.commands.executeCommand("cursorCurseMonitor.openDashboard"),
          },
        ];
        if (promptState.showPrompt && promptState.copy) {
          actions.push(
            {
              label: promptState.copy.cta,
              action: () => {
                void readCachedAccountEmail().then(async (accountEmail) => {
                  const email = await vscode.window.showInputBox({
                    title: promptState.copy!.title,
                    prompt: promptState.copy!.body,
                    value: accountEmail ?? "",
                    placeHolder: "you@example.com",
                    validateInput: (value) =>
                      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : "Enter a valid email",
                  });
                  if (!email) return;
                  const result = await subscribeForProductUpdates(context, email, "extension");
                  NotificationProvider.show({
                    title: result.ok ? "Subscribed" : "Subscribe failed",
                    message: result.message,
                    type: result.ok ? "success" : "error",
                    duration: 6000,
                  });
                });
              },
            },
            {
              label: promptState.copy.later,
              action: () => {
                void snoozeSubscribePrompt(context);
              },
            }
          );
        }
        NotificationProvider.show({
          title: "Welcome to Cursor Curse Monitor",
          message:
            "Thank you for installing! Monitor Cursor usage, manage budgets, and recover lost chats when worktrees change.",
          type: "info",
          duration: 8000,
          customIcon: "welcome-animation.svg",
          actions,
        });
      });
    }, 1500);
  } else {
    setTimeout(() => {
      void maybeShowSubscribePrompt(context);
    }, SUBSCRIBE_PROMPT_DELAY_MS);
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
      new DashboardViewProvider(monitor, context.extensionUri, context.extension.packageJSON.version ?? "0.0.0", context)
    ),
    vscode.commands.registerCommand("cursorCurseMonitor.openDashboard", async () => {
      await vscode.commands.executeCommand(
        "workbench.view.extension.cursor-curse-monitor-lorapok"
      );
    }),
    vscode.commands.registerCommand("cursorCurseMonitor.refresh", async () => {
      await monitor?.refresh();
    }),
    vscode.commands.registerCommand(
      "cursorCurseMonitor.applyFallbackModel",
      async () => {
        const result = await applyComposerFallbackModel();
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
    vscode.commands.registerCommand("cursorCurseMonitor.scanWorkspace", async () => {
      await securityMonitor?.scanWorkspace();
    }),
    vscode.commands.registerCommand("cursorCurseMonitor.scanClipboard", async () => {
      await securityMonitor?.scanClipboard();
    }),
    vscode.commands.registerCommand("cursorCurseMonitor.reindexConversations", async () => {
      const result = await reindexMissingConversations(context.extensionUri);
      if (!result.success) {
        NotificationProvider.show({
          title: "Conversation Reindex Failed",
          message: result.error || "Could not rebuild conversation indexes.",
          type: "error",
          duration: 7000,
        });
        return;
      }

      const indexed = result.searchIndexed.length;
      const restored = result.sidebarRestored.length;
      const skipped = result.skipped.length;
      NotificationProvider.show({
        title: "Conversation Recovery Complete",
        message:
          indexed || restored
            ? `Indexed ${indexed} chat(s) for search and restored ${restored} to the sidebar. ${skipped} already present. Reload the window to refresh the chat list.`
            : `No missing conversations found since Aug 10. ${skipped} chat(s) were already indexed.`,
        type: "success",
        duration: 9000,
        actions: [
          {
            label: "Reload Window",
            action: () => void vscode.commands.executeCommand("workbench.action.reloadWindow"),
          },
        ],
      });
    }),
    monitor,
    securityMonitor
  );
}

export function deactivate(): void {
  securityMonitor?.dispose();
  securityMonitor = undefined;
  monitor?.dispose();
  monitor = undefined;
}
