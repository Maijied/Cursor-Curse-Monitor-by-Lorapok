import { describe, expect, it } from "vitest";
import { classifyMailRetryRecipient } from "../../functions/api/_shared/mail-retry-filter.js";
import { BROADCAST_MAX_PER_INVOCATION } from "../../functions/api/_shared/subscriber-broadcast.js";

describe("mail-retry-filter", () => {
  it("treats production inboxes as retryable", () => {
    expect(classifyMailRetryRecipient("user@gmail.com")).toEqual({ kind: "production" });
  });

  it("skips example.com probes", () => {
    expect(classifyMailRetryRecipient("stable-1@example.com").kind).toBe("test");
    expect(classifyMailRetryRecipient("probe-invalid@example.com").kind).toBe("test");
  });

  it("skips testmail inboxes and probe local parts", () => {
    expect(classifyMailRetryRecipient("abc@inbox.testmail.app").kind).toBe("test");
    expect(classifyMailRetryRecipient("mail-test-123@lorapok.tech").kind).toBe("test");
  });
});

describe("subscriber-broadcast batching", () => {
  it("caps batch size for Worker subrequest safety", () => {
    expect(BROADCAST_MAX_PER_INVOCATION).toBeLessThanOrEqual(10);
    expect(BROADCAST_MAX_PER_INVOCATION).toBeGreaterThan(0);
  });
});
