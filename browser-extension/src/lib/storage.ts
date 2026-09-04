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
  anonymousUsageStats: true,
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

const FIREFOX_PRODUCTION_EXTENSION_ID = "cursor-curse-monitor@lorapok.tech";

function isUnpackedDevBuild(): boolean {
  if (__CCM_DEV_STORAGE_PREFIX__) {
    return true;
  }
  try {
    const manifest = browser.runtime.getManifest() as {
      update_url?: string;
      browser_specific_settings?: { gecko?: { id?: string } };
    };
    if (manifest.update_url) {
      return false;
    }
    const geckoId = manifest.browser_specific_settings?.gecko?.id;
    if (geckoId === FIREFOX_PRODUCTION_EXTENSION_ID) {
      return false;
    }
    if (browser.runtime.id === FIREFOX_PRODUCTION_EXTENSION_ID) {
      return false;
    }
    // Default production storage keys (Chrome sideload zip, store builds without update_url).
    return false;
  } catch {
    return false;
  }
}

function storageKey(base: string): string {
  return `${isUnpackedDevBuild() ? "ccm_dev_" : ""}${base}`;
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

let settingsWriteChain: Promise<void> = Promise.resolve();

function withSerializedSettingsWrite<T>(operation: () => Promise<T>): Promise<T> {
  const run = settingsWriteChain.then(operation, operation);
  settingsWriteChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

interface SettingsStorageRead {
  settings: ExtensionSettings;
  migrated: ReturnType<typeof migrateLegacyToken>;
  key: string;
}

async function readSettingsFromStorage(): Promise<SettingsStorageRead> {
  const key = storageKey(SETTINGS_KEY);
  const data = await browser.storage.local.get(key);
  const raw = (data[key] as Partial<ExtensionSettings> | undefined) ?? {};
  const migrated = migrateLegacyToken(
    Array.isArray(raw.accounts) ? raw.accounts : undefined,
    raw.accessToken,
    raw.email
  );
  return {
    settings: withDerivedAuth({
      ...DEFAULTS,
      ...raw,
      accounts: migrated.accounts,
      activeAccountId: raw.activeAccountId ?? migrated.activeAccountId,
    }),
    migrated,
    key,
  };
}

async function persistSettings(settings: ExtensionSettings): Promise<void> {
  await browser.storage.local.set({ [storageKey(SETTINGS_KEY)]: settings });
}

export async function getSettings(): Promise<ExtensionSettings> {
  const { settings, migrated, key } = await readSettingsFromStorage();
  if (migrated.migrated) {
    await withSerializedSettingsWrite(async () => {
      await browser.storage.local.set({ [key]: settings });
    });
  }
  return settings;
}

export async function updateSettings(
  patch: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  return withSerializedSettingsWrite(async () => {
    const { settings: current } = await readSettingsFromStorage();
    const next = withDerivedAuth({ ...current, ...patch });
    await persistSettings(next);
    return next;
  });
}

export interface SaveTokenOptions {
  /** When true, switch to the upserted account. Passive cookie/page capture should leave false. */
  setActive?: boolean;
}

export async function saveToken(
  token: string,
  email?: string | null,
  options?: SaveTokenOptions
): Promise<void> {
  await withSerializedSettingsWrite(async () => {
    const { settings: current } = await readSettingsFromStorage();
    const result = upsertSavedAccount(current.accounts, token, email);
    const shouldActivate =
      options?.setActive === true ||
      !current.activeAccountId ||
      !current.accessToken ||
      current.activeAccountId === result.id;
    const next = withDerivedAuth({
      ...current,
      accounts: result.accounts,
      activeAccountId: shouldActivate ? result.id : current.activeAccountId,
    });
    await persistSettings(next);
  });
}

export async function setActiveAccount(id: string): Promise<void> {
  await withSerializedSettingsWrite(async () => {
    const { settings: current } = await readSettingsFromStorage();
    const active = resolveSavedAuth(current.accounts, id);
    const next = withDerivedAuth({
      ...current,
      activeAccountId: active?.id ?? null,
      accessToken: active?.token ?? null,
      email: active?.email ?? null,
    });
    await persistSettings(next);
  });
}

export async function removeAccount(id: string): Promise<void> {
  await withSerializedSettingsWrite(async () => {
    const { settings: current } = await readSettingsFromStorage();
    const accounts = current.accounts.filter((account) => account.id !== id);
    const keepId = current.activeAccountId === id ? null : current.activeAccountId;
    const active = resolveSavedAuth(accounts, keepId);
    const next = withDerivedAuth({
      ...current,
      accounts,
      activeAccountId: active?.id ?? null,
      accessToken: active?.token ?? null,
      email: active?.email ?? null,
    });
    await persistSettings(next);
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
