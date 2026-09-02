const assert = require("assert");

async function run() {
  const Module = require("module");
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "vscode") {
      return require.resolve("./mock-vscode.js");
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  require("ts-node").register({ transpileOnly: true });
  const { validateCipPackage, CIP_FORMAT_VERSION } = require("../src/cipPackage.ts");

  const validRecord = {
    originalId: "abc",
    contentHash: "hash",
    title: "Hello",
    body: "Hello body",
    branch: "main",
    createdAt: 1000,
    updatedAt: 2000,
    turns: [{ role: "user", text: "Hello", createdAt: 1000 }],
    workspaceLabel: "demo",
  };

  const valid = validateCipPackage({
    header: {
      cipVersion: CIP_FORMAT_VERSION,
      exporterVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      sourceKind: "agent-transcripts",
      ownerHash: "deadbeef",
      itemCount: 1,
      sanitized: true,
      lookbackDays: 0,
    },
    records: [validRecord],
  });
  assert.strictEqual(valid.ok, true);

  const missingHeader = validateCipPackage({ records: [validRecord] });
  assert.strictEqual(missingHeader.ok, false);
  assert.match(missingHeader.error, /missing header/i);

  const wrongVersion = validateCipPackage({
    header: { cipVersion: 99, sourceKind: "agent-transcripts" },
    records: [validRecord],
  });
  assert.strictEqual(wrongVersion.ok, false);
  assert.match(wrongVersion.error, /unsupported index package version/i);

  const emptyRecords = validateCipPackage({
    header: { cipVersion: CIP_FORMAT_VERSION, sourceKind: "agent-transcripts" },
    records: [],
  });
  assert.strictEqual(emptyRecords.ok, false);
  assert.match(emptyRecords.error, /no records/i);

  const nonArrayRecords = validateCipPackage({
    header: { cipVersion: CIP_FORMAT_VERSION, sourceKind: "agent-transcripts" },
    records: "nope",
  });
  assert.strictEqual(nonArrayRecords.ok, false);
  assert.match(nonArrayRecords.error, /missing records/i);

  const invalidTurn = validateCipPackage({
    header: { cipVersion: CIP_FORMAT_VERSION, sourceKind: "agent-transcripts" },
    records: [{ ...validRecord, turns: [{ role: "system", text: "nope", createdAt: 1 }] }],
  });
  assert.strictEqual(invalidTurn.ok, false);
  assert.match(invalidTurn.error, /invalid role/i);

  const missingText = validateCipPackage({
    header: { cipVersion: CIP_FORMAT_VERSION, sourceKind: "agent-transcripts" },
    records: [{ ...validRecord, turns: [{ role: "user", text: "   ", createdAt: 1 }] }],
  });
  assert.strictEqual(missingText.ok, false);
  assert.match(missingText.error, /missing text/i);

  const wrongSource = validateCipPackage({
    header: { cipVersion: CIP_FORMAT_VERSION, sourceKind: "other" },
    records: [validRecord],
  });
  assert.strictEqual(wrongSource.ok, false);
  assert.match(wrongSource.error, /sourceKind/i);

  const badTimestamp = validateCipPackage({
    header: { cipVersion: CIP_FORMAT_VERSION, sourceKind: "agent-transcripts" },
    records: [{ ...validRecord, createdAt: Number.NaN }],
  });
  assert.strictEqual(badTimestamp.ok, false);
  assert.match(badTimestamp.error, /invalid timestamps/i);

  Module._resolveFilename = originalResolveFilename;
  console.log("cip-validation test passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
