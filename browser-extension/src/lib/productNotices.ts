import browser from "webextension-polyfill";
import { extensionStorageKey } from "./storage";

const NOTICE_URL = "https://cursor-dev.lorapok.tech/api/notice";
const DISMISSED_KEY = extensionStorageKey("dismissedProductNoticeIds");
const LAST_CHECK_KEY = extensionStorageKey("productNoticeLastCheckMs");
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

type RemoteNotice = {
  enabled?: boolean;
  id?: string | null;
  title?: string;
  message?: string;
  shortMessage?: string;
  dismissible?: boolean;
};

async function getDismissed(): Promise<string[]> {
  const data = await browser.storage.local.get(DISMISSED_KEY);
  const raw = data[DISMISSED_KEY];
  return Array.isArray(raw) ? raw.map(String) : [];
}

async function setDismissed(ids: string[]): Promise<void> {
  await browser.storage.local.set({ [DISMISSED_KEY]: ids });
}

export async function maybeShowProductNotice(enabled: boolean): Promise<void> {
  if (!enabled) return;

  const data = await browser.storage.local.get(LAST_CHECK_KEY);
  const lastCheck = Number(data[LAST_CHECK_KEY] ?? 0);
  const now = Date.now();
  if (now - lastCheck < CHECK_INTERVAL_MS) return;

  let notice: RemoteNotice | null = null;
  try {
    const response = await fetch(NOTICE_URL, { cache: "no-store" });
    if (response.ok) {
      const parsed = (await response.json()) as RemoteNotice;
      if (parsed?.enabled && parsed.title && (parsed.shortMessage || parsed.message)) {
        notice = parsed;
      }
    }
  } catch {
    return;
  }

  await browser.storage.local.set({ [LAST_CHECK_KEY]: now });
  if (!notice) return;

  const noticeId = notice.id || notice.title || "notice";
  const dismissed = await getDismissed();
  if (dismissed.includes(noticeId)) return;

  await browser.notifications.create(`product-notice-${noticeId}`, {
    type: "basic",
    iconUrl: browser.runtime.getURL("icons/icon-128.png"),
    title: notice.title || "Cursor Curse Monitor",
    message: notice.shortMessage || notice.message || "",
  });

  if (notice.dismissible !== false) {
    const next = [...new Set([...dismissed, noticeId])];
    await setDismissed(next);
  }
}

export async function refreshProductNotice(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [LAST_CHECK_KEY]: 0 });
  await maybeShowProductNotice(enabled);
}
