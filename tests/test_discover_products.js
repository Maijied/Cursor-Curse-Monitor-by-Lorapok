const assert = require("assert");

require("ts-node").register({ transpileOnly: true });
const {
  isCursorAuthDiscoverableProduct,
  shouldDiscoverProductInstall,
} = require("../src/cursorAuth.ts");

assert.equal(isCursorAuthDiscoverableProduct("Cursor"), true);
assert.equal(isCursorAuthDiscoverableProduct("Windsurf"), true);
assert.equal(isCursorAuthDiscoverableProduct("Code"), false);
assert.equal(isCursorAuthDiscoverableProduct("VSCodium"), false);
assert.equal(isCursorAuthDiscoverableProduct("RandomFork"), false);

assert.equal(shouldDiscoverProductInstall("dCursor", "Cursor"), false);
assert.equal(shouldDiscoverProductInstall("dCursor", "dCursor"), true);
assert.equal(shouldDiscoverProductInstall("Cursor", "Cursor"), true);
assert.equal(shouldDiscoverProductInstall("Code", "Visual Studio Code"), false);
assert.equal(shouldDiscoverProductInstall("Windsurf", "Cursor"), true);
assert.equal(shouldDiscoverProductInstall("RandomFork", "Cursor"), false);

process.env.CCM_INCLUDE_DCURSOR = "1";
assert.equal(shouldDiscoverProductInstall("dCursor", "Cursor"), true);
delete process.env.CCM_INCLUDE_DCURSOR;

process.env.CCM_DISCOVER_PRODUCTS = "Cursor,Windsurf";
assert.equal(isCursorAuthDiscoverableProduct("Windsurf"), true);
assert.equal(isCursorAuthDiscoverableProduct("dCursor"), false);
delete process.env.CCM_DISCOVER_PRODUCTS;

console.log("discover-products test passed");
