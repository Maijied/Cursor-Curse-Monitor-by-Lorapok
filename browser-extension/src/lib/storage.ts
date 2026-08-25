import browser from "webextension-polyfill";
import type { DashboardSnapshot } from "@lorapok/cursor-monitor-shared";

export interface ExtensionSettings {
  accessToken: string | null;
  email: string | null;
  customBudgetLimit: number;
  warnAtPercent: number;
  pollIntervalMinutes: number;
  anonymousUsageStats: boolean;
  productNotices: boolean;
  subscribedEmail: string | null;
  subscribeSnoozeUntil: number | null;
  installId: string;
  lastPingDay: string | null;
  lastSeenVersion: string | null;
}

const DEFAULTS: ExtensionSettings = {
  accessToken: null,
  email: null,
  customBudgetLimit: 0,
  warnAtPercent: 80,
  pollIntervalMinutes: 5,
  anonymousUsageStats: false,
  productNotices: true,
  subscribedEmail: null,
  subscribeSnoozeUntil: null,
  installId: "",
  lastPingDay: null,
  lastSeenVersion: null,
};

const SETTINGS_KEY = "settings";
const HISTORY_KEY = "usageHistoryV1";
const SNAPSHOT_KEY = "lastSnapshot";

export async function getSettings(): Promise<ExtensionSettings> {
  const data = await browser.storage.local.get(SETTINGS_KEY);
  const raw = data[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  return { ...DEFAULTS, ...raw };
}

export async function updateSettings(
  patch: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await browser.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function saveToken(token: string, email?: string | null): Promise<void> {
  await updateSettings({
    accessToken: token,
    email: email ?? null,
  });
}

export async function clearAuth(): Promise<void> {
  await updateSettings({ accessToken: null, email: null });
}

export async function getHistory() {
  const data = await browser.storage.local.get(HISTORY_KEY);
  return (data[HISTORY_KEY] as import("@lorapok/cursor-monitor-shared").UsageHistoryPoint[]) ?? [];
}

export async function saveHistory(
  history: import("@lorapok/cursor-monitor-shared").UsageHistoryPoint[]
): Promise<void> {
  await browser.storage.local.set({ [HISTORY_KEY]: history });
}

export async function saveSnapshot(snapshot: DashboardSnapshot): Promise<void> {
  await browser.storage.local.set({ [SNAPSHOT_KEY]: snapshot });
}

export async function getSnapshot(): Promise<DashboardSnapshot | null> {
  const data = await browser.storage.local.get(SNAPSHOT_KEY);
  return (data[SNAPSHOT_KEY] as DashboardSnapshot) ?? null;
}

export async function getOrCreateInstallId(): Promise<string> {
  const settings = await getSettings();
  if (settings.installId && settings.installId.length >= 8) {
    return settings.installId;
  }
  const installId = crypto.randomUUID();
  await updateSettings({ installId });
  return installId;
}
