import * as vscode from "vscode";
import type { ReindexResult } from "./conversationReindex";
import type { ReindexPolicy } from "./reindexConfig";
import { NotificationProvider } from "./notificationProvider";

export function notifyReindexResult(result: ReindexResult, policy: ReindexPolicy): void {
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
  const reloadHint = policy.requireEditorQuit
    ? "Reload the window to refresh the chat list."
    : "Reload the window if chats do not appear immediately.";
  NotificationProvider.show({
    title: "Conversation Recovery Complete",
    message:
      indexed || restored
        ? `Indexed ${indexed} chat(s) for search and restored ${restored} to the sidebar. ${skipped} already present. ${reloadHint}`
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
}
