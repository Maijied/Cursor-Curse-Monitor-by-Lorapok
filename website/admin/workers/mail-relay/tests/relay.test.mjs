#!/usr/bin/env node
import assert from "node:assert/strict";
import worker from "../src/index.js";

const sent = [];
const env = {
  EMAIL: {
    send: async (msg) => {
      sent.push(msg);
    },
  },
};

const ok = await worker.fetch(
  new Request("https://internal/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: "user@example.com",
      from: { email: "cursor.monitor@lorapok.tech", name: "CCM" },
      subject: "test",
      html: "<p>hi</p>",
      text: "hi",
    }),
  }),
  env
);

assert.equal(ok.status, 200);
assert.deepEqual(await ok.json(), { sent: true, transport: "cloudflare-relay" });
assert.equal(sent.length, 1);
assert.equal(sent[0].to, "user@example.com");

const bad = await worker.fetch(new Request("https://internal/send", { method: "GET" }), env);
assert.equal(bad.status, 405);

console.log("mail-relay tests: OK");
