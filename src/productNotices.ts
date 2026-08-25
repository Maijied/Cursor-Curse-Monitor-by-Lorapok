import * as vscode from "vscode";
import { NotificationProvider } from "./notificationProvider";

const DEFAULT_NOTICE_URL = "https://cursor-dev.lorapok.tech/api/notice";
const DISMISSED_IDS_KEY = "dismissedProductNoticeIds";
const LAST_CHECK_KEY = "productNoticeLastCheckMs";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type RemoteNotice = {
  enabled?: boolean;
  id?: string | null;
  title?: string;
  message?: string;
  shortMessage?: string;
  severity?: string;
  feedbackUrl?: string;
  collaborateUrl?: string;
  dismissible?: boolean;
};

function noticeUrl(): string {
  return (
    vscode.workspace.getConfiguration("cursorCurseMonitor").get<string>("productNoticeUrl")?.trim() ||
    DEFAULT_NOTICE_URL
  );
}

function severityToType(severity?: string): "info" | "warning" | "error" | "success" {
  if (severity === "critical" || severity === "error") return "error";
  if (severity === "warning") return "warning";
  return "info";
}

async function fetchActiveNotice(): Promise<RemoteNotice | null> {
  try {
    const response = await fetch(noticeUrl(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const notice = (await response.json()) as RemoteNotice;
    if (!notice?.enabled || !notice.title) return null;
    if (!notice.shortMessage && !notice.message) return null;
    return notice;
  } catch {
    return null;
  }
}

export async function maybeShowProductNotice(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration("cursorCurseMonitor");
  if (!config.get<boolean>("productNotices", true)) return;

  const lastCheck = context.globalState.get<number>(LAST_CHECK_KEY) ?? 0;
  const now = Date.now();
  if (now - lastCheck < CHECK_INTERVAL_MS) return;

  const notice = await fetchActiveNotice();
  await context.globalState.update(LAST_CHECK_KEY, now);
  if (!notice) return;

  const noticeId = notice.id || notice.title || "notice";
  const dismissed = context.globalState.get<string[]>(DISMISSED_IDS_KEY) ?? [];
  if (dismissed.includes(noticeId)) return;

  const message = notice.shortMessage || notice.message || notice.title || "";
  const actions: Array<{ label: string; action: () => void }> = [];

  if (notice.feedbackUrl) {
    actions.push({
      label: "Learn more",
      action: () => void vscode.env.openExternal(vscode.Uri.parse(notice.feedbackUrl!)),
    });
  }
  if (notice.dismissible !== false) {
    actions.push({
      label: "Dismiss",
      action: () => {
        const next = [...new Set([...dismissed, noticeId])];
        void context.globalState.update(DISMISSED_IDS_KEY, next);
      },
    });
  }

  NotificationProvider.show({
    title: notice.title,
    message,
    type: severityToType(notice.severity),
    duration: 12000,
    actions,
  });
}

/** Force a notice check (e.g. after enabling the setting). */
export async function refreshProductNotice(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(LAST_CHECK_KEY, 0);
  await maybeShowProductNotice(context);
}
