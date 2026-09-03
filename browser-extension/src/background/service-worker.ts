import browser from "webextension-polyfill";
import { MESSAGE_TYPES } from "../lib/messaging";
import { captureAuthFromCursorCookies } from "../lib/authCapture";
import { refreshSnapshot } from "../lib/monitor";
import { maybeShowProductNotice } from "../lib/productNotices";
import { getOrCreateInstallId, getSettings, getSnapshot, saveToken, updateSettings } from "../lib/storage";
import { emailFromCursorToken } from "@lorapok/cursor-monitor-shared";

declare const __EXTENSION_VERSION__: string;

let warnedAtThreshold = false;

async function maybeNotify(snapshot: Awaited<ReturnType<typeof refreshSnapshot>>) {
  const budget = snapshot.budget;
  if (!budget) return;
  const settings = await getSettings();
  const percent = budget.usdBudgetActive
    ? budget.budgetPercentUsed
    : budget.percentUsed;
  if (percent >= settings.warnAtPercent && !warnedAtThreshold && percent < 100) {
    warnedAtThreshold = true;
    const id = "usage-warning";
    await browser.notifications.create(id, {
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon-128.png"),
      title: "Cursor Usage Warning",
      message: budget.usdBudgetActive
        ? `Budget at ${Math.round(budget.budgetPercentUsed)}% ($${budget.spentUsd.toFixed(2)} / $${budget.capUsd.toFixed(2)}).`
        : `Cursor usage at ${Math.round(percent)}%.`,
    });
  }
  if (percent < settings.warnAtPercent) {
    warnedAtThreshold = false;
  }
}

function updateBadge(snapshot: Awaited<ReturnType<typeof refreshSnapshot>>) {
  if (!snapshot.budget) {
    void browser.action.setBadgeText({ text: "" });
    return;
  }
  const pct = Math.round(
    snapshot.budget.usdBudgetActive
      ? snapshot.budget.budgetPercentUsed
      : snapshot.budget.percentUsed
  );
  void browser.action.setBadgeText({ text: String(pct) });
  void browser.action.setBadgeBackgroundColor({
    color: pct >= 100 ? "#ff6b6b" : pct >= 80 ? "#f59e0b" : "#34d399",
  });
}

async function runRefresh(): Promise<void> {
  const settings = await getSettings();
  if (!settings.accessToken) {
    await captureAuthFromCursorCookies();
  }
  const snapshot = await refreshSnapshot();
  updateBadge(snapshot);
  await maybeNotify(snapshot);
  const refreshedSettings = await getSettings();
  await maybeShowProductNotice(refreshedSettings.productNotices);
  void browser.runtime.sendMessage({
    type: MESSAGE_TYPES.SNAPSHOT,
    payload: snapshot,
  });
}

browser.runtime.onMessage.addListener((message) => {
  const msg = message as { type: string };
  if (msg.type === MESSAGE_TYPES.REFRESH) {
    return runRefresh().then(() => getSnapshot());
  }
  if (msg.type === MESSAGE_TYPES.GET_SNAPSHOT) {
    return getSnapshot();
  }
  return undefined;
});

browser.runtime.onMessage.addListener((message, _sender) => {
  const msg = message as { type: string; token?: string; email?: string };
  if (msg.type === "tokenCaptured" && msg.token) {
    const email = msg.email ?? emailFromCursorToken(msg.token);
    return saveToken(msg.token, email).then(() => runRefresh());
  }
  if (msg.type === "probeAuth") {
    return captureAuthFromCursorCookies().then((captured) =>
      captured ? runRefresh().then(() => true) : false
    );
  }
  return undefined;
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll-usage") {
    void runRefresh();
  }
  if (alarm.name === "usage-heartbeat") {
    void sendUsageHeartbeat();
  }
});

async function scheduleAlarm(): Promise<void> {
  const settings = await getSettings();
  const period = Math.max(1, settings.pollIntervalMinutes);
  await browser.alarms.clear("poll-usage");
  await browser.alarms.create("poll-usage", { periodInMinutes: period });
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) {
    const oldActive = (changes.settings.oldValue as { activeAccountId?: string | null } | undefined)
      ?.activeAccountId;
    const newActive = (changes.settings.newValue as { activeAccountId?: string | null } | undefined)
      ?.activeAccountId;
    if (oldActive !== newActive) {
      warnedAtThreshold = false;
    }
    void scheduleAlarm();
    void scheduleHeartbeatAlarm();
    void runRefresh();
  }
});

browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) {
    return;
  }
  if (!/https:\/\/([a-z0-9-]+\.)*cursor\.com/i.test(tab.url)) {
    return;
  }
  void captureAuthFromCursorCookies().then((captured) => {
    if (captured) {
      void runRefresh();
    }
  });
});

void scheduleAlarm();
void scheduleHeartbeatAlarm();
void runRefresh();

const HEARTBEAT_MINUTES = 4;

async function sendUsageHeartbeat(): Promise<void> {
  const settings = await getSettings();
  if (!settings.anonymousUsageStats) return;

  const installId = await getOrCreateInstallId();
  try {
    const res = await fetch("https://cursor-dev.lorapok.tech/api/usage/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installId,
        os: "browser",
        host: "browser",
        version: __EXTENSION_VERSION__,
      }),
    });
    if (res.ok) {
      await updateSettings({ lastPingDay: new Date().toISOString().slice(0, 10) });
    }
  } catch {
    /* ignore */
  }
}

async function scheduleHeartbeatAlarm(): Promise<void> {
  const settings = await getSettings();
  await browser.alarms.clear("usage-heartbeat");
  if (!settings.anonymousUsageStats) return;
  await browser.alarms.create("usage-heartbeat", { periodInMinutes: HEARTBEAT_MINUTES });
  void sendUsageHeartbeat();
}
