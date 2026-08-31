const assert = require("assert");

require("ts-node").register({ transpileOnly: true });
const { shouldDiscoverProductInstall } = require("../src/cursorAuth.ts");

assert.equal(shouldDiscoverProductInstall("dCursor", "Cursor"), false);
assert.equal(shouldDiscoverProductInstall("dCursor", "dCursor"), true);
assert.equal(shouldDiscoverProductInstall("Cursor", "Cursor"), true);

process.env.CCM_INCLUDE_DCURSOR = "1";
assert.equal(shouldDiscoverProductInstall("dCursor", "Cursor"), true);
delete process.env.CCM_INCLUDE_DCURSOR;

console.log("discover-products test passed");
