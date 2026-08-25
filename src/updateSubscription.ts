import * as vscode from "vscode";
import {
  getSubscribePromptCopy,
  snoozeUntilNextDayMs,
  shouldShowSubscribePrompt,
  subscribePromptVariant,
  SUBSCRIBE_PROMPT_DELAY_MS,
  type SubscribePromptCopy,
} from "@lorapok/cursor-monitor-shared";
import { getOrCreateInstallId } from "./telemetry";
import { NotificationProvider } from "./notificationProvider";
import { readCachedAccountEmail } from "./cursorAuth";

const DEFAULT_SUBSCRIBE_URL = "https://cursor-dev.lorapok.tech/api/subscribe";
const SUBSCRIBED_EMAIL_KEY = "productUpdatesSubscribedEmail";
const SUBSCRIBE_SNOOZE_UNTIL_KEY = "productUpdatesSubscribeSnoozeUntil";
const SUBSCRIBE_DECLINED_KEY = "productUpdatesSubscribeDeclined";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim().toLowerCase());
}

export async function getSubscribedEmail(context: vscode.ExtensionContext): Promise<string | null> {
  const stored = context.globalState.get<string>(SUBSCRIBED_EMAIL_KEY);
  return stored && isValidEmail(stored) ? stored.toLowerCase() : null;
}

export async function getSubscribeSnoozeUntil(context: vscode.ExtensionContext): Promise<number | null> {
  const value = context.globalState.get<number>(SUBSCRIBE_SNOOZE_UNTIL_KEY);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function getSubscribeDeclined(context: vscode.ExtensionContext): Promise<boolean> {
  return Boolean(context.globalState.get<boolean>(SUBSCRIBE_DECLINED_KEY));
}

export async function snoozeSubscribePrompt(context: vscode.ExtensionContext): Promise<number> {
  const until = snoozeUntilNextDayMs();
  await context.globalState.update(SUBSCRIBE_SNOOZE_UNTIL_KEY, until);
  return until;
}

export async function declineSubscribePrompt(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(SUBSCRIBE_DECLINED_KEY, true);
}

export async function getSubscribePromptViewState(context: vscode.ExtensionContext): Promise<{
  showPrompt: boolean;
  subscribedEmail: string | null;
  copy: SubscribePromptCopy | null;
}> {
  const subscribedEmail = await getSubscribedEmail(context);
  const snoozeUntilMs = await getSubscribeSnoozeUntil(context);
  const declined = await getSubscribeDeclined(context);
  const showPrompt = shouldShowSubscribePrompt({ subscribedEmail, snoozeUntilMs, declined });
  if (!showPrompt) {
    return { showPrompt: false, subscribedEmail, copy: null };
  }
  const variant = subscribePromptVariant({ subscribedEmail, snoozeUntilMs });
  return {
    showPrompt: true,
    subscribedEmail,
    copy: getSubscribePromptCopy(variant),
  };
}

export async function subscribeForProductUpdates(
  context: vscode.ExtensionContext,
  email: string,
  source: "extension" | "extension-dashboard" = "extension"
): Promise<{ ok: boolean; message: string }> {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const subscribeUrl =
    vscode.workspace.getConfiguration("cursorCurseMonitor").get<string>("subscribeUrl")?.trim() ||
    DEFAULT_SUBSCRIBE_URL;
  const installId = getOrCreateInstallId(context);

  try {
    const response = await fetch(subscribeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email: normalized,
        source,
        installId,
        consent: true,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      error?: string;
    };
    if (!response.ok) {
      return { ok: false, message: data.error || "Could not subscribe right now." };
    }
    await context.globalState.update(SUBSCRIBED_EMAIL_KEY, normalized);
    await context.globalState.update(SUBSCRIBE_SNOOZE_UNTIL_KEY, undefined);
    await context.globalState.update(SUBSCRIBE_DECLINED_KEY, undefined);
    return { ok: true, message: data.message || "You're subscribed to release updates." };
  } catch {
    return { ok: false, message: "Network error — try again later." };
  }
}

export async function maybeShowSubscribePrompt(context: vscode.ExtensionContext): Promise<void> {
  const state = await getSubscribePromptViewState(context);
  if (!state.showPrompt || !state.copy) return;

  const copy = state.copy;
  NotificationProvider.show({
    title: copy.title,
    message: copy.body,
    type: "info",
    duration: 12000,
    actions: [
      {
        label: copy.cta,
        action: () => {
          void readCachedAccountEmail().then(async (accountEmail) => {
            const email = await vscode.window.showInputBox({
              title: copy.title,
              prompt: copy.body,
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
        label: copy.later,
        action: () => {
          void snoozeSubscribePrompt(context);
        },
      },
    ],
  });
}
