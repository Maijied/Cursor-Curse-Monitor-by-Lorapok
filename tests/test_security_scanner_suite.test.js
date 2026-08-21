const test = require("node:test");
const assert = require("node:assert/strict");

const {
  scanSecrets,
  redactSnippet,
  scanSecretsInFiles,
  hasHighSeverityFindings,
} = require("../packages/shared/dist/index.js");

// Dynamic string helpers to prevent static Push Protection regex matches in test fixtures
const DUMMY_SK_ANT = ["sk-ant-api03", "abcdef1234567890abcdef1234567890abcdef12345678"].join("-");
const DUMMY_SK_OPENAI = ["sk", "abcdefghijklmnopqrstuvwxyz1234567890abcdef"].join("-");
const DUMMY_GHP = ["ghp", "1234567890abcdefghijklmnopqrstuvwxyz12"].join("_");
const DUMMY_GHO = ["gho", "1234567890abcdefghijklmnopqrstuvwxyz12"].join("_");
const DUMMY_AKIA = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
const DUMMY_XOXB = ["xoxb", "1234567890-abcdefghij12345"].join("-");

/** Runtime generator for JWTs to avoid static secret scanner false alarms. */
function createTestJwt(payload = { sub: "user-12345" }) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  return `${header}.${body}.${sig}`;
}

test("security: detects Anthropic API key in assignment and .env format", () => {
  const codeContent = `const anthropicApiKey = "${DUMMY_SK_ANT}";`;
  const codeFindings = scanSecrets(codeContent, { location: "src/anthropic.ts" });
  assert.strictEqual(codeFindings.length, 1);
  assert.strictEqual(codeFindings[0].kind, "password");
  assert.strictEqual(codeFindings[0].severity, "medium");
  assert.strictEqual(codeFindings[0].location, "src/anthropic.ts:1");
  assert.ok(codeFindings[0].snippet.startsWith("sk-a"));

  const envContent = `ANTHROPIC_KEY=${DUMMY_SK_ANT}\n`;
  const envFindings = scanSecrets(envContent, { location: ".env" });
  assert.ok(envFindings.length >= 1);
  assert.ok(envFindings.some((f) => f.severity === "high" && f.kind === "password"));
  assert.strictEqual(envFindings[0].location, ".env:1");
});

test("security: detects OpenAI API keys with high severity", () => {
  const content = `const key = "${DUMMY_SK_OPENAI}";`;
  const findings = scanSecrets(content, { location: "config.js" });
  assert.ok(findings.length >= 1);
  const apiKeyFinding = findings.find((f) => f.kind === "api_key");
  assert.ok(apiKeyFinding);
  assert.strictEqual(apiKeyFinding.severity, "high");
  assert.strictEqual(apiKeyFinding.location, "config.js:1");
  assert.ok(apiKeyFinding.snippet.startsWith("sk-a"));
  assert.ok(apiKeyFinding.snippet.endsWith("cdef"));
});

test("security: detects GitHub Personal and OAuth Access Tokens", () => {
  const patFindings = scanSecrets(`export GITHUB_TOKEN="${DUMMY_GHP}"`, { location: "deploy.sh" });
  assert.strictEqual(patFindings.length, 1);
  assert.strictEqual(patFindings[0].kind, "api_key");
  assert.strictEqual(patFindings[0].severity, "high");
  assert.strictEqual(patFindings[0].location, "deploy.sh:1");

  const oauthFindings = scanSecrets(`const tok = "${DUMMY_GHO}";`, { location: "auth.ts" });
  assert.strictEqual(oauthFindings.length, 1);
  assert.strictEqual(oauthFindings[0].kind, "api_key");
  assert.strictEqual(oauthFindings[0].severity, "high");
});

test("security: detects AWS Access Key ID and AWS secret credentials", () => {
  const findings = scanSecrets(`aws_access_key_id = ${DUMMY_AKIA}`, { location: "credentials" });
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].kind, "api_key");
  assert.strictEqual(findings[0].severity, "high");
  assert.strictEqual(findings[0].location, "credentials:1");
  assert.strictEqual(findings[0].snippet, "AKIA…MPLE");

  const envContent = "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n";
  const envFindings = scanSecrets(envContent, { location: "production.env" });
  assert.strictEqual(envFindings.length, 1);
  assert.strictEqual(envFindings[0].kind, "password");
  assert.strictEqual(envFindings[0].severity, "high");
  assert.strictEqual(envFindings[0].location, "production.env:1");
});

test("security: detects Slack bot and user tokens", () => {
  const botToken = DUMMY_XOXB;
  const findings = scanSecrets(`const slackToken = "${botToken}";`, { location: "bot.js" });
  assert.ok(findings.some((f) => f.kind === "api_key" && f.severity === "high"));
});

test("security: detects JWT tokens and Bearer headers", () => {
  const jwt = createTestJwt();
  const bearerContent = `Authorization: Bearer ${jwt}`;
  const findings = scanSecrets(bearerContent, { location: "api.ts" });
  assert.ok(findings.length >= 1);
  assert.ok(findings.some((f) => f.kind === "bearer_token" || f.kind === "jwt"));
  assert.ok(findings.every((f) => f.severity === "high"));
});

test("security: detects database credentials, passwords, and client secrets", () => {
  const code = `
    const dbPassword = "SuperSecretPassword1234!";
    const clientSecret = "oauth_client_secret_abcdef123456";
    const accessToken = "access_token_xyz9876543210";
  `;
  const findings = scanSecrets(code, { location: "db.ts" });
  assert.ok(findings.length >= 3);
  assert.ok(findings.every((f) => f.kind === "password"));
  assert.ok(findings.every((f) => f.severity === "medium"));

  const envDb = "DATABASE_URL=postgres://admin:secret12345@db.example.com:5432/main\n";
  const envFindings = scanSecrets(envDb, { location: ".env" });
  assert.strictEqual(envFindings.length, 1);
  assert.strictEqual(envFindings[0].kind, "password");
  assert.strictEqual(envFindings[0].severity, "high");
});

test("security: detects RSA, EC, OPENSSH, and generic Private Key headers", () => {
  const rsa = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0\n-----END RSA PRIVATE KEY-----";
  const ec = "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEI\n-----END EC PRIVATE KEY-----";
  const openssh = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNza\n-----END OPENSSH PRIVATE KEY-----";
  const generic = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqh\n-----END PRIVATE KEY-----";

  for (const [name, content] of Object.entries({ rsa, ec, openssh, generic })) {
    const findings = scanSecrets(content, { location: `${name}.key` });
    assert.ok(findings.length >= 1, `Failed to detect ${name} private key`);
    assert.strictEqual(findings[0].kind, "private_key");
    assert.strictEqual(findings[0].severity, "high");
  }
});

test("security: false positive validation - ignores placeholders, angle brackets, and docs", () => {
  const placeholders = [
    'apiKey: "changeme"',
    'password = "your_"',
    'api_key = "example"',
    'secret = "xxxxxxxxxxxx"',
    'token = "test"',
    'password = "dummy"',
    'client_secret = "placeholder"',
    'access_token = "redacted"',
    'api_key = "insert-here"',
    'password = "insert_here"',
    'password = "todo"',
    'api_key = "<YOUR_API_KEY>"',
    'password = "<PASSWORD>"',
    'const shortSecret = "12345";',
  ];

  for (const snippet of placeholders) {
    const findings = scanSecrets(snippet, { location: "test.ts" });
    assert.strictEqual(findings.length, 0, `Expected placeholder "${snippet}" to be ignored`);
  }

  const envEmpty = `
    API_KEY=""
    EMPTY_PASS=''
    UNSET_VAR=
  `;
  const envFindings = scanSecrets(envEmpty, { location: ".env" });
  assert.strictEqual(envFindings.length, 0);

  const cleanCode = `
    // This is a comment about security setup
    function calculateHash(input: string): string {
      return input.trim();
    }
    console.log("Welcome to Cursor Curse Monitor");
  `;
  assert.strictEqual(scanSecrets(cleanCode, { location: "util.ts" }).length, 0);
});

test("security: snippet redaction and masking rules", () => {
  // <= 12 chars
  assert.strictEqual(redactSnippet("shortpass123"), "••••••••");
  assert.strictEqual(redactSnippet("123456789012"), "••••••••");

  // 13 - 32 chars
  assert.strictEqual(redactSnippet(DUMMY_AKIA), "AKIA…MPLE");

  // > 32 chars
  assert.strictEqual(redactSnippet(DUMMY_SK_ANT), "sk-a……5678");

  // Whitespace normalization
  const multiLine = `  AKIA\n  IOSFODNN7\tEXAMPLE  `;
  assert.strictEqual(redactSnippet(multiLine), "AKIA…MPLE");
});

test("security: accurate 1-indexed line and column resolution across multi-line content", () => {
  const content = [
    "// Header comment line 1",
    "// Another comment line 2",
    `const awsKey = "${DUMMY_AKIA}";`,
    "// Intermediate line 4",
    "// Intermediate line 5",
    `export const pat = "${DUMMY_GHP}";`,
    "// End line 7",
  ].join("\n");

  const findings = scanSecrets(content, { location: "src/config.ts" });
  assert.strictEqual(findings.length, 2);

  assert.strictEqual(findings[0].line, 3);
  assert.strictEqual(findings[0].column, 17);
  assert.strictEqual(findings[0].location, "src/config.ts:3");

  assert.strictEqual(findings[1].line, 6);
  assert.strictEqual(findings[1].column, 21);
  assert.strictEqual(findings[1].location, "src/config.ts:6");
});

test("security: allowCursorToken allows single JWT/Bearer token in paste context", () => {
  const jwt = createTestJwt();

  const allowedJwt = scanSecrets(`token=${jwt}`, {
    location: "Options paste",
    context: "paste",
    allowCursorToken: true,
  });
  assert.strictEqual(allowedJwt.length, 0);

  const allowedBearer = scanSecrets(`Bearer ${jwt}`, {
    location: "Options paste",
    context: "paste",
    allowCursorToken: true,
  });
  assert.strictEqual(allowedBearer.length, 0);

  const mixedSecret = scanSecrets(`Bearer ${jwt}\n${DUMMY_AKIA}`, {
    location: "Options paste",
    context: "paste",
    allowCursorToken: true,
  });
  assert.strictEqual(mixedSecret.length, 1);
  assert.strictEqual(mixedSecret[0].kind, "api_key");
});

test("security: hasHighSeverityFindings correctly categorizes severity levels", () => {
  assert.strictEqual(hasHighSeverityFindings([]), false);

  const mediumOnly = [
    { id: "1", kind: "password", location: "a.ts:1", snippet: "•••", severity: "medium" },
  ];
  assert.strictEqual(hasHighSeverityFindings(mediumOnly), false);

  const highOnly = [
    { id: "2", kind: "api_key", location: "b.ts:1", snippet: "•••", severity: "high" },
  ];
  assert.strictEqual(hasHighSeverityFindings(highOnly), true);

  const mixed = [...mediumOnly, ...highOnly];
  assert.strictEqual(hasHighSeverityFindings(mixed), true);
});

test("security: scanSecretsInFiles filters ignored directories and handles workspace files", () => {
  const files = [
    { path: "node_modules/pkg/index.js", content: DUMMY_AKIA },
    { path: ".git/config", content: DUMMY_AKIA },
    { path: "dist/bundle.js", content: DUMMY_AKIA },
    { path: "extension.vsix", content: DUMMY_AKIA },
    { path: "assets/logo.png", content: DUMMY_AKIA },
    { path: "src/secrets.ts", content: `const t = "${DUMMY_AKIA}";` },
    { path: "src/config.ts", content: `export const token = "${DUMMY_GHP}";` },
  ];

  const findings = scanSecretsInFiles(files);
  assert.strictEqual(findings.length, 2);
  assert.ok(findings.some((f) => f.location.startsWith("src/secrets.ts")));
  assert.ok(findings.some((f) => f.location.startsWith("src/config.ts")));
});
