const test = require("node:test");
const assert = require("node:assert/strict");

require("ts-node").register({ transpileOnly: true });

const {
  SYSTEM_ACCOUNT_ID,
  accountDisplayLabel,
  emailFromCursorToken,
  jwtFromWorkosCursorSessionCookie,
  migrateLegacyToken,
  resolveSavedAuth,
  toPublicAccount,
  upsertSavedAccount,
} = require("../packages/shared/src/cursorAccounts.ts");

function jwtWithEmail(email) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ email })).toString("base64url");
  return `${header}.${payload}.sig`;
}

test("emailFromCursorToken reads JWT email and ignores junk", () => {
  assert.equal(emailFromCursorToken(jwtWithEmail("work@example.com")), "work@example.com");
  assert.equal(emailFromCursorToken("not-a-jwt"), null);
  assert.equal(emailFromCursorToken(""), null);
});

test("jwtFromWorkosCursorSessionCookie extracts JWT from dashboard cookie", () => {
  const token = jwtWithEmail("dash@example.com");
  assert.equal(jwtFromWorkosCursorSessionCookie(`user_01ABC::${token}`), token);
  assert.equal(jwtFromWorkosCursorSessionCookie(encodeURIComponent(`user_01ABC::${token}`)), token);
  assert.equal(jwtFromWorkosCursorSessionCookie(token), token);
  assert.equal(jwtFromWorkosCursorSessionCookie("short"), null);
});

test("upsertSavedAccount updates the same token instead of duplicating", () => {
  const first = upsertSavedAccount([], "token-one-abcdefghijklmnopqrstuv", "one@example.com");
  assert.equal(first.accounts.length, 1);
  const second = upsertSavedAccount(first.accounts, "token-one-abcdefghijklmnopqrstuv", "one@example.com", "Work");
  assert.equal(second.accounts.length, 1);
  assert.equal(second.id, first.id);
  assert.equal(second.accounts[0].label, "Work");
  const third = upsertSavedAccount(second.accounts, "token-two-abcdefghijklmnopqrstuv", "two@example.com");
  assert.equal(third.accounts.length, 2);
  assert.notEqual(third.id, first.id);
});

test("toPublicAccount never includes the token", () => {
  const { accounts } = upsertSavedAccount([], "super-secret-token-value-123456", "hide@example.com");
  const publicAccount = toPublicAccount(accounts[0]);
  assert.equal(publicAccount.email, "hide@example.com");
  assert.equal("token" in publicAccount, false);
  assert.equal(JSON.stringify(publicAccount).includes("super-secret"), false);
});

test("migrateLegacyToken converts a single accessToken once", () => {
  const migrated = migrateLegacyToken(undefined, "legacy-token-abcdefghijklmnopqrstuv", "old@example.com");
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.accounts.length, 1);
  assert.equal(migrated.accounts[0].email, "old@example.com");
  const already = migrateLegacyToken(migrated.accounts, "legacy-token-abcdefghijklmnopqrstuv", "old@example.com");
  assert.equal(already.migrated, false);
  assert.equal(already.accounts.length, 1);
  const emptySchema = migrateLegacyToken([], "should-not-migrate", "x@example.com");
  assert.equal(emptySchema.migrated, false);
  assert.equal(emptySchema.accounts.length, 0);
});

test("resolveSavedAuth falls back to the first saved account", () => {
  const { accounts, id } = upsertSavedAccount([], "token-a-abcdefghijklmnopqrstuv", "a@example.com");
  const next = upsertSavedAccount(accounts, "token-b-abcdefghijklmnopqrstuv", "b@example.com");
  assert.equal(resolveSavedAuth(next.accounts, id)?.email, "a@example.com");
  assert.equal(resolveSavedAuth(next.accounts, "missing")?.email, "a@example.com");
  assert.equal(resolveSavedAuth([], "missing"), null);
});

test("accountDisplayLabel distinguishes this session", () => {
  assert.equal(accountDisplayLabel({ email: "me@example.com", source: "system" }), "me@example.com (this session)");
  assert.equal(accountDisplayLabel({ email: null, source: "system" }), "This Cursor session");
  assert.equal(SYSTEM_ACCOUNT_ID, "system");
});
