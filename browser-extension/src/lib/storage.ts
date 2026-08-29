import browser from "webextension-polyfill";
import type { DashboardSnapshot } from "@lorapok/cursor-monitor-shared";
import {
  migrateLegacyToken,
  resolveSavedAuth,
  upsertSavedAccount,
  type StoredCursorAccount,
} from "@lorapok/cursor-monitor-shared";

export interface ExtensionSettings {
  accessToken: string | null;
  email: string | null;
  accounts: StoredCursorAccount[];
  activeAccountId: string | null;
  customBudgetLimit: number;
  warnAtPercent: number;
  pollIntervalMinutes: number;
  anonymousUsageStats: boolean;
  productNotices: boolean;
  subscribedEmail: string | null;
  subscribeSnoozeUntil: number | null;
  subscribeDeclined: boolean;
  installId: string;
  lastPingDay: string | null;
  lastSeenVersion: string | null;
}

const DEFAULTS: ExtensionSettings = {
  accessToken: null,
  email: null,
  accounts: [],
  activeAccountId: null,
  customBudgetLimit: 0,
  warnAtPercent: 80,
  pollIntervalMinutes: 5,
  anonymousUsageStats: false,
  productNotices: true,
  subscribedEmail: null,
  subscribeSnoozeUntil: null,
  subscribeDeclined: false,
  installId: "",
  lastPingDay: null,
  lastSeenVersion: null,
};

const SETTINGS_KEY = "settings";
const HISTORY_KEY = "usageHistoryV1";
const SNAPSHOT_KEY = "lastSnapshot";

function isUnpackedDevBuild(): boolean {
  try {
    const manifest = browser.runtime.getManifest() as { update_url?: string };
    return !manifest.update_url;
  } catch {
    return false;
  }
}

const STORAGE_PREFIX = isUnpackedDevBuild() ? "ccm_dev_" : "";

function storageKey(base: string): string {
  return `${STORAGE_PREFIX}${base}`;
}

export function extensionStorageKey(base: string): string {
  return storageKey(base);
}

function withDerivedAuth(settings: ExtensionSettings): ExtensionSettings {
  const active = resolveSavedAuth(settings.accounts, settings.activeAccountId);
  return {
    ...settings,
    accounts: settings.accounts,
    activeAccountId: active?.id ?? null,
    accessToken: active?.token ?? null,
    email: active?.email ?? settings.email,
  };
}

export async function getSettings(): Promise<ExtensionSettings> {
  const key = storageKey(SETTINGS_KEY);
  const data = await browser.storage.local.get(key);
  const raw = (data[key] as Partial<ExtensionSettings> | undefined) ?? {};
  const migrated = migrateLegacyToken(
    Array.isArray(raw.accounts) ? raw.accounts : undefined,
    raw.accessToken,
    raw.email
  );
  const next = withDerivedAuth({
    ...DEFAULTS,
    ...raw,
    accounts: migrated.accounts,
    activeAccountId: raw.activeAccountId ?? migrated.activeAccountId,
  });
  if (migrated.migrated) {
    await browser.storage.local.set({ [key]: next });
  }
  return next;
}

export async function updateSettings(
  patch: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = withDerivedAuth({ ...current, ...patch });
  await browser.storage.local.set({ [storageKey(SETTINGS_KEY)]: next });
  return next;
}

export async function saveToken(token: string, email?: string | null): Promise<void> {
  const current = await getSettings();
  const result = upsertSavedAccount(current.accounts, token, email);
  const added = result.accounts.find((account) => account.id === result.id);
  await updateSettings({
    accounts: result.accounts,
    activeAccountId: result.id,
    accessToken: added?.token ?? token,
    email: added?.email ?? email ?? null,
  });
}

export async function setActiveAccount(id: string): Promise<void> {
  const current = await getSettings();
  const active = resolveSavedAuth(current.accounts, id);
  await updateSettings({
    activeAccountId: active?.id ?? null,
    accessToken: active?.token ?? null,
    email: active?.email ?? null,
  });
}

export async function removeAccount(id: string): Promise<void> {
  const current = await getSettings();
  const accounts = current.accounts.filter((account) => account.id !== id);
  const keepId = current.activeAccountId === id ? null : current.activeAccountId;
  const active = resolveSavedAuth(accounts, keepId);
  await updateSettings({
    accounts,
    activeAccountId: active?.id ?? null,
    accessToken: active?.token ?? null,
    email: active?.email ?? null,
  });
}

export async function clearAuth(): Promise<void> {
  await updateSettings({
    accessToken: null,
    email: null,
    accounts: [],
    activeAccountId: null,
  });
}

export async function getHistory() {
  const key = storageKey(HISTORY_KEY);
  const data = await browser.storage.local.get(key);
  return (data[key] as import("@lorapok/cursor-monitor-shared").UsageHistoryPoint[]) ?? [];
}

export async function saveHistory(
  history: import("@lorapok/cursor-monitor-shared").UsageHistoryPoint[]
): Promise<void> {
  await browser.storage.local.set({ [storageKey(HISTORY_KEY)]: history });
}

export async function saveSnapshot(snapshot: DashboardSnapshot): Promise<void> {
  await browser.storage.local.set({ [storageKey(SNAPSHOT_KEY)]: snapshot });
}

export async function getSnapshot(): Promise<DashboardSnapshot | null> {
  const key = storageKey(SNAPSHOT_KEY);
  const data = await browser.storage.local.get(key);
  return (data[key] as DashboardSnapshot) ?? null;
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
