const assert = require("assert");
const { scanSecrets } = require("../../packages/shared/dist/scanSecrets.js");

function scanPasteField(text, location, allowCursorToken = false) {
  const findings = scanSecrets(text, {
    location,
    context: "paste",
    allowCursorToken,
  });
  const nonToken = findings.filter(
    (f) => f.kind !== "bearer_token" && f.kind !== "jwt"
  );
  if (nonToken.length > 0) return nonToken;
  if (!allowCursorToken && findings.length > 0) return findings;
  return [];
}

const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc";
const ok = scanPasteField(jwt, "Options paste", true);
assert.equal(ok.length, 0);

const bad = scanPasteField("ghp_abcdefghijklmnopqrstuvwxyz1234567890", "Options paste", true);
assert.ok(bad.length >= 1);

console.log("test-security-scan.cjs: OK");
