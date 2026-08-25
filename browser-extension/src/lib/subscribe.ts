import { getOrCreateInstallId, getSettings, updateSettings } from "./storage";
import { randomSnoozeUntilMs } from "@lorapok/cursor-monitor-shared";

const SUBSCRIBE_URL = "https://cursor-dev.lorapok.tech/api/subscribe";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim().toLowerCase());
}

export async function subscribeForProductUpdates(
  email: string,
  source: "browser-addon" | "browser-addon-options" = "browser-addon"
): Promise<{ ok: boolean; message: string }> {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const installId = await getOrCreateInstallId();
  try {
    const response = await fetch(SUBSCRIBE_URL, {
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
      message?: string;
      error?: string;
    };
    if (!response.ok) {
      return { ok: false, message: data.error || "Could not subscribe right now." };
    }
    await updateSettings({ subscribedEmail: normalized, subscribeSnoozeUntil: null });
    return { ok: true, message: data.message || "You're subscribed to release updates." };
  } catch {
    return { ok: false, message: "Network error — try again later." };
  }
}

export async function snoozeSubscribePrompt(): Promise<void> {
  await updateSettings({ subscribeSnoozeUntil: randomSnoozeUntilMs() });
}
