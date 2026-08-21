const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const site = JSON.parse(fs.readFileSync(path.join(root, "website/site-data.json"), "utf8"));
const seo = JSON.parse(fs.readFileSync(path.join(root, "website/seo.json"), "utf8"));

assert.strictEqual(site.version, pkg.version);
assert.strictEqual(site.packageVersion, pkg.version);
assert.strictEqual(seo.packageVersion, pkg.version);
assert.strictEqual(site.install.releaseTag, `./scripts/release.sh ${pkg.version}`);
assert.ok(["candidate", "published"].includes(site.releaseStatus));
if (site.releaseStatus !== "published") {
  assert.notStrictEqual(site.syncStatus, "synced", "unpublished release candidates must not claim synced");
}
console.log("release-integrity test passed");
