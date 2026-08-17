const assert = require("assert");

async function run() {
  require("ts-node").register({ transpileOnly: true });
  const { scanSecrets, redactSnippet, scanSecretsInFiles } = require("../packages/shared/src/scanSecrets.ts");

  const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
  const findings = scanSecrets(`const t = "Bearer ${jwt}";`, { location: "test.ts" });
  assert(findings.length >= 1, "should detect bearer/jwt");
  assert(findings[0].snippet.includes("…"), "snippet should be redacted");

  const safe = scanSecrets('const x = "changeme"; api_key = "example";', { location: "test.ts" });
  assert.equal(safe.length, 0, "placeholders should not alert");

  const pem = scanSecrets("-----BEGIN RSA PRIVATE KEY-----\nMIIE", { location: "key.pem" });
  assert(pem.some((f) => f.kind === "private_key"));

  const allowed = scanSecrets(`token=${jwt}`, {
    location: "Options paste",
    context: "paste",
    allowCursorToken: true,
  });
  assert.equal(allowed.length, 0, "single cursor token allowed in paste");

  const multi = scanSecrets(`ghp_abcdefghijklmnopqrstuvwxyz1234567890\n${jwt}`, {
    location: "Options paste",
    context: "paste",
    allowCursorToken: true,
  });
  assert(multi.length >= 1, "multiple secrets should still alert");

  const redacted = redactSnippet("sk-abcdefghijklmnopqrstuvwxyz");
  assert(redacted.startsWith("sk-a"), redacted);

  const files = scanSecretsInFiles([
    { path: "src/.env", content: "API_KEY=supersecretvalue123\n" },
  ]);
  assert(files.length >= 1);

  console.log("test_scan_secrets.js: OK");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
