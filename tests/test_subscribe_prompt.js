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
const minMs = SUBSCRIBE_SNOOZE_MIN_DAYS * 86400000;
const maxMs = SUBSCRIBE_SNOOZE_MAX_DAYS * 86400000;
assert.ok(snooze >= now + minMs);
assert.ok(snooze <= now + maxMs);

assert.ok(getSubscribePromptCopy("first").title.length > 10);
assert.ok(getSubscribePromptCopy("reminder").later.toLowerCase().includes("later"));

console.log("subscribe-prompt test passed");
