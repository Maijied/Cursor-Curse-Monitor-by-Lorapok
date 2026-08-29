import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFeedbackMailto,
  buildGithubFeedbackUrl,
  SUPPORT_EMAIL,
} from "../packages/shared/dist/productLinks.js";

test("buildFeedbackMailto includes support email and version", () => {
  const url = buildFeedbackMailto({ kind: "bug", version: "1.0.0-beta.1", editor: "Cursor 1.2" });
  assert.ok(url.startsWith(`mailto:${SUPPORT_EMAIL}`));
  assert.match(url, /subject=/);
  assert.match(url, /1\.0\.0-beta\.1/);
});

test("buildGithubFeedbackUrl selects template", () => {
  const url = buildGithubFeedbackUrl("feature");
  assert.match(url, /template=feedback\.md/);
  assert.match(url, /enhancement/);
});
