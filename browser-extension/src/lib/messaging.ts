import browser from "webextension-polyfill";
import type { DashboardSnapshot } from "@lorapok/cursor-monitor-shared";

export const MESSAGE_TYPES = {
  SNAPSHOT: "snapshot",
  REFRESH: "refresh",
  GET_SNAPSHOT: "getSnapshot",
} as const;

export type ExtensionMessage =
  | { type: typeof MESSAGE_TYPES.SNAPSHOT; payload: DashboardSnapshot }
  | { type: typeof MESSAGE_TYPES.REFRESH }
  | { type: typeof MESSAGE_TYPES.GET_SNAPSHOT };

export function onSnapshot(
  callback: (snapshot: DashboardSnapshot) => void
): () => void {
  const listener = (message: unknown) => {
    const msg = message as ExtensionMessage;
    if (msg?.type === MESSAGE_TYPES.SNAPSHOT) {
      callback(msg.payload);
    }
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}

export async function requestRefresh(): Promise<DashboardSnapshot | null> {
  const response = await browser.runtime.sendMessage({
    type: MESSAGE_TYPES.REFRESH,
  });
  return (response as DashboardSnapshot | null) ?? null;
}

export async function fetchSnapshot(): Promise<DashboardSnapshot | null> {
  const response = await browser.runtime.sendMessage({
    type: MESSAGE_TYPES.GET_SNAPSHOT,
  });
  return (response as DashboardSnapshot | null) ?? null;
}
