export const SUBSCRIBE_PROMPT_DELAY_MS = 30_000;
export const SUBSCRIBE_SNOOZE_ONE_DAY_MS = 24 * 60 * 60 * 1000;
/** @deprecated Use snoozeUntilNextDayMs — kept for migration/tests */
export const SUBSCRIBE_SNOOZE_MIN_DAYS = 1;
export const SUBSCRIBE_SNOOZE_MAX_DAYS = 1;

export const SUBSCRIBE_STORAGE_KEYS = {
  email: "ccm-subscribe-email",
  snoozeUntil: "ccm-subscribe-snooze-until",
  declined: "ccm-subscribe-declined",
} as const;

export type SubscribePromptVariant = "first" | "reminder";

export type SubscribePromptState = {
  subscribedEmail: string | null;
  snoozeUntilMs: number | null;
  declined?: boolean;
  nowMs?: number;
};

export type SubscribePromptCopy = {
  title: string;
  body: string;
  cta: string;
  later: string;
};

const FIRST_COPY: SubscribePromptCopy = {
  title: "Never miss a fix that saves your chats",
  body: "Get Lorapok release emails for conversation recovery, quota tips, and stable builds — only when we ship something worth your time.",
  cta: "Subscribe to updates",
  later: "Maybe later",
};

const REMINDER_COPY: SubscribePromptCopy = {
  title: "Still building in the open — want a heads-up?",
  body: "One short email when we ship recovery tools, usage insights, or breaking fixes. No newsletters, no spam — unsubscribe any time.",
  cta: "Get release emails",
  later: "Remind me later",
};

export function shouldShowSubscribePrompt(state: SubscribePromptState): boolean {
  if (state.declined) return false;
  if (state.subscribedEmail) return false;
  if (!state.snoozeUntilMs) return true;
  const now = state.nowMs ?? Date.now();
  return now >= state.snoozeUntilMs;
}

export function subscribePromptVariant(state: SubscribePromptState): SubscribePromptVariant {
  if (!state.snoozeUntilMs) return "first";
  const now = state.nowMs ?? Date.now();
  return now >= state.snoozeUntilMs ? "reminder" : "first";
}

export function getSubscribePromptCopy(variant: SubscribePromptVariant): SubscribePromptCopy {
  return variant === "reminder" ? REMINDER_COPY : FIRST_COPY;
}

/** Snooze until the next calendar day (24h). */
export function snoozeUntilNextDayMs(nowMs = Date.now()): number {
  return nowMs + SUBSCRIBE_SNOOZE_ONE_DAY_MS;
}

/** @deprecated Use snoozeUntilNextDayMs */
export function randomSnoozeUntilMs(nowMs = Date.now()): number {
  return snoozeUntilNextDayMs(nowMs);
}
