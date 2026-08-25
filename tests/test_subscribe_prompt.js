const assert = require("assert");
const {
  shouldShowSubscribePrompt,
  randomSnoozeUntilMs,
  getSubscribePromptCopy,
  SUBSCRIBE_SNOOZE_MIN_DAYS,
  SUBSCRIBE_SNOOZE_MAX_DAYS,
} = require("../packages/shared/dist/subscribePrompt.js");

const now = Date.UTC(2026, 7, 25, 0, 0, 0);

assert.strictEqual(shouldShowSubscribePrompt({ subscribedEmail: "a@b.com", snoozeUntilMs: null }), false);
assert.strictEqual(shouldShowSubscribePrompt({ subscribedEmail: null, snoozeUntilMs: null }), true);
assert.strictEqual(
  shouldShowSubscribePrompt({ subscribedEmail: null, snoozeUntilMs: now + 86400000, nowMs: now }),
  false
);
assert.strictEqual(
  shouldShowSubscribePrompt({ subscribedEmail: null, snoozeUntilMs: now - 1, nowMs: now }),
  true
);

const snooze = randomSnoozeUntilMs(now);
const dayMs = 86400000;
assert.strictEqual(snooze, now + dayMs);

assert.strictEqual(shouldShowSubscribePrompt({ subscribedEmail: null, snoozeUntilMs: null, declined: true }), false);

assert.ok(getSubscribePromptCopy("first").title.length > 10);
assert.ok(getSubscribePromptCopy("reminder").later.toLowerCase().includes("later"));

console.log("subscribe-prompt test passed");
