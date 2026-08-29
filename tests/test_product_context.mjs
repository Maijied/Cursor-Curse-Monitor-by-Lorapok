import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProductContext } from "../scripts/lib-product-context.mjs";

test("releaseUrl uses published release when ahead of package version", () => {
  const ctx = buildProductContext(
    { version: "1.0.26", repository: { url: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok" } },
    { publishedReleaseVersion: "1.0.34" }
  );
  assert.equal(ctx.version, "1.0.34");
  assert.equal(ctx.packageVersion, "1.0.26");
  assert.equal(ctx.releaseVersion, "1.0.34");
  assert.equal(ctx.publishedReleaseVersion, "1.0.34");
  assert.equal(
    ctx.releaseUrl,
    "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v1.0.34"
  );
});

test("releaseUrl falls back to package version when no published release", () => {
  const ctx = buildProductContext({ version: "1.0.26" });
  assert.equal(ctx.releaseVersion, "1.0.26");
  assert.match(ctx.releaseUrl, /\/releases\/tag\/v1\.0\.26$/);
});
