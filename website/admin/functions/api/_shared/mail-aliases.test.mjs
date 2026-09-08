#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  createMailAlias,
  identityToAliasRow,
  listMailAliases,
  syncAliasAuthAccess,
  updateMailAlias,
} from "./mail-aliases.js";

const kv = new Map();

/** @type {Record<string, unknown>} */
const env = {
  ADMIN_KV: {
    get: async (key) => kv.get(key) ?? null,
    put: async (key, value) => {
      kv.set(key, value);
    },
  },
  ADMIN_MASTER_EMAIL: "master@lorapok.tech",
};

const identity = {
  localPart: "releases",
  displayName: "Releases",
  label: "Releases",
  project: "ccm",
  coworkerEmail: "colleague@gmail.com",
  category: "product",
  forwardTo: "ops@example.com",
  enabled: true,
  authAllowed: true,
  authRole: "operator",
  routingStatus: "simulated",
  cloudflareRuleId: null,
  provisionedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const row = identityToAliasRow(identity, "lorapok.tech");
assert.equal(row.fullAddress, "releases@lorapok.tech");
assert.equal(row.authAllowed, true);
assert.equal(row.project, "ccm");

const created = await createMailAlias(
  env,
  {
    localPart: "project.bot",
    label: "Project Bot",
    forwardTo: "ops@example.com",
    provisionRouting: false,
    authAllowed: true,
    authRole: "viewer",
  },
  "master@lorapok.tech"
);
assert.equal(created.alias.localPart, "project.bot");
assert.equal(created.alias.authAllowed, true);

const allowlist = JSON.parse(kv.get("admin-emails") ?? "[]");
assert.ok(allowlist.includes("project.bot@lorapok.tech"));

const aliases = await listMailAliases(env);
assert.ok(aliases.some((item) => item.localPart === "project.bot"));

await updateMailAlias(env, "project.bot", { authAllowed: false }, "master@lorapok.tech");
const allowlistAfter = JSON.parse(kv.get("admin-emails") ?? "[]");
assert.ok(!allowlistAfter.includes("project.bot@lorapok.tech"));

const skipped = await syncAliasAuthAccess(env, { localPart: "master", authRole: "admin" }, "lorapok.tech", {
  enable: true,
});
assert.equal(skipped.skipped, true);

console.log("mail-aliases.test.mjs: OK");
