import test from "node:test";
import assert from "node:assert/strict";
import { resolveCiVersion } from "../scripts/resolve-ci-version.mjs";

test("resolveCiVersion returns live max and recommended patch bump", async () => {
  const payload = await resolveCiVersion({ bump: "patch" });
  assert.ok(payload.liveMax);
  assert.ok(payload.buildVersion);
  assert.ok(payload.recommendedVersion);
  assert.ok(payload.recommendedTag?.startsWith("v"));
  assert.notEqual(payload.recommendedVersion, "0.0.0");
});
