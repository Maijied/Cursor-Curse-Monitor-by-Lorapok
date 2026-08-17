const assert = require("assert");
const Module = require("module");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "vscode") {
    return require.resolve("./mock-vscode.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require("ts-node").register({ transpileOnly: true });

const {
  getOrCreateInstallId,
  buildHeartbeatPayload,
} = require("../src/telemetry.ts");

function mockContext(initial = {}) {
  const store = { ...initial };
  return {
    globalState: {
      get(key, def) {
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : def;
      },
      update(key, value) {
        store[key] = value;
        return Promise.resolve();
      },
    },
    _store: store,
  };
}

async function run() {
  const ctx = mockContext();
  const id1 = getOrCreateInstallId(ctx);
  const id2 = getOrCreateInstallId(ctx);
  assert.strictEqual(id1, id2, "installId must be stable");
  assert.match(id1, /^[0-9a-f-]{36}$/i);

  const offline = mockContext({ anonymousInstallId: id1 });
  const id3 = getOrCreateInstallId(offline);
  assert.strictEqual(id3, id1, "offline upgrade must reuse installId");

  const payload = buildHeartbeatPayload(id1, "0.5.8", "linux", "cursor");
  assert.deepStrictEqual(Object.keys(payload).sort(), ["host", "installId", "os", "version"]);
  assert.ok(!JSON.stringify(payload).includes("token"));
  assert.ok(!JSON.stringify(payload).includes("/home"));

  console.log("telemetry uniqueness test passed");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
