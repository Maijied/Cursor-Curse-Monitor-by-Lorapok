const assert = require("assert");
const fs = require("fs");
const path = require("path");

async function run() {
  const dir = path.join(__dirname, "mock-backup-recovery");
  fs.mkdirSync(dir, { recursive: true });

  const dbPath = path.join(dir, "state.vscdb");
  fs.writeFileSync(dbPath, "live-db");
  fs.writeFileSync(path.join(dir, "state.vscdb.backup-old"), "x".repeat(2048));
  fs.writeFileSync(path.join(dir, "state.vscdb-wal.backup-old"), "wal");
  fs.writeFileSync(path.join(dir, "state.vscdb.tmp-old"), "tmp");

  process.env.CURSOR_DB_PATH = dbPath;

  require("ts-node").register({ transpileOnly: true });
  const {
    scanMonitoringDbBackups,
    recoverMonitoringDbBackups,
    formatBackupBytes,
    shouldNotifyDbBackupWaste,
  } = require("../src/cursorAuth.ts");

  const scan = scanMonitoringDbBackups();
  assert.strictEqual(scan.count, 3);
  assert.ok(scan.totalBytes >= 2048);
  assert.strictEqual(scan.directory, dir);
  assert.strictEqual(shouldNotifyDbBackupWaste(scan), true);
  assert.strictEqual(formatBackupBytes(2048), "2 KB");

  const result = recoverMonitoringDbBackups();
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.removed, 3);
  assert.ok(result.freedBytes >= 2048);

  const after = scanMonitoringDbBackups();
  assert.strictEqual(after.count, 0);
  assert.strictEqual(after.totalBytes, 0);
  assert.ok(fs.existsSync(dbPath), "live database must remain");

  console.log("db backup recovery test passed");
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    delete process.env.CURSOR_DB_PATH;
    const dir = path.join(__dirname, "mock-backup-recovery");
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });
