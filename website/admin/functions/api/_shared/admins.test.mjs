import assert from "node:assert/strict";
import {
  getAllowedAdminEmails,
  tryGetMasterEmail,
  addStoredAdminEmail,
  listStoredAdminEmails,
} from "./admins.js";

const kvStore = new Map();
const kvEnv = {
  ADMIN_KV: {
    get: async (key) => kvStore.get(key) ?? null,
    put: async (key, value) => kvStore.set(key, value),
  },
};

assert.equal(tryGetMasterEmail({}), null);
assert.equal(tryGetMasterEmail({ ADMIN_MASTER_EMAIL: "Master@Example.com" }), "master@example.com");

const withMaster = {
  ...kvEnv,
  ADMIN_MASTER_EMAIL: "master@lorapok.tech",
  ADMIN_EMAILS: "env@lorapok.tech",
};

let allowed = await getAllowedAdminEmails(withMaster);
assert.ok(allowed.has("master@lorapok.tech"));
assert.ok(allowed.has("env@lorapok.tech"));

await addStoredAdminEmail(withMaster, "kv@lorapok.tech");
allowed = await getAllowedAdminEmails(withMaster);
assert.ok(allowed.has("kv@lorapok.tech"));
assert.deepEqual(await listStoredAdminEmails(withMaster), ["kv@lorapok.tech"]);

const kvOnly = {
  ...kvEnv,
  ADMIN_EMAILS: "ops@lorapok.tech",
};
allowed = await getAllowedAdminEmails(kvOnly);
assert.ok(allowed.has("ops@lorapok.tech"));
assert.equal(allowed.has("master@lorapok.tech"), false);

console.log("admins.test.mjs: OK");
