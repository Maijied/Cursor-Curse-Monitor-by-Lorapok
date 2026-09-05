import { describe, expect, it, vi } from "vitest";
import { retryFailedMailboxMessages } from "../../functions/api/_shared/mailbox-retry.js";

vi.mock("../../functions/api/_shared/mail.js", () => ({
  sendMail: vi.fn(async () => ({ sent: true, transport: "resend", mailboxId: "new-id" })),
}));

import { sendMail } from "../../functions/api/_shared/mail.js";

function mockKv(store = new Map()) {
  const messages = [
    {
      id: "fail-1",
      direction: "outbound",
      from: "cursor.monitor@lorapok.tech",
      to: "user@example.com",
      subject: "Welcome",
      text: "hello",
      html: "<p>hello</p>",
      status: "failed",
      category: "subscribe",
      ts: "2026-09-05T00:00:00.000Z",
      error: "KV quota",
      read: false,
    },
    {
      id: "fail-2",
      direction: "outbound",
      from: "cursor.monitor@lorapok.tech",
      to: "user@example.com",
      subject: "Welcome",
      text: "hello duplicate",
      html: "<p>dup</p>",
      status: "failed",
      category: "subscribe",
      ts: "2026-09-05T00:01:00.000Z",
      error: "KV quota",
      read: false,
    },
  ];
  store.set("mailbox:messages", JSON.stringify(messages));
  return {
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => {
      store.set(key, value);
    },
    list: async () => ({ keys: [], list_complete: true }),
  };
}

describe("mailbox retry", () => {
  it("resends failed outbound messages and marks originals sent", async () => {
    const store = new Map();
    const env = { ADMIN_KV: mockKv(store) };
    const result = await retryFailedMailboxMessages(env, { sentBy: "admin@test" });
    expect(result.attempted).toBe(2);
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
    expect(sendMail).toHaveBeenCalledTimes(1);

    const saved = JSON.parse(String(store.get("mailbox:messages")));
    const original = saved.find((row) => row.id === "fail-1");
    expect(original.status).toBe("sent");
    expect(original.retriedAt).toBeTruthy();
  });
});
