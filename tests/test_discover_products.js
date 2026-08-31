const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

function loadCursorAuth() {
  require("ts-node").register({ transpileOnly: true });
  return require("../src/cursorAuth.ts");
}

function withIsolatedHome(homeDir, fn) {
  fs.rmSync(homeDir, { recursive: true, force: true });
  fs.mkdirSync(homeDir, { recursive: true });
  const previousHome = process.env.HOME;
  process.env.HOME = homeDir;
  delete require.cache[require.resolve("../src/cursorAuth.ts")];
  try {
    return fn(loadCursorAuth());
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    delete require.cache[require.resolve("../src/cursorAuth.ts")];
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
}

const {
  isCursorAuthDiscoverableProduct,
  shouldDiscoverProductInstall,
} = loadCursorAuth();

assert.equal(isCursorAuthDiscoverableProduct("Cursor"), true);
assert.equal(isCursorAuthDiscoverableProduct("Windsurf"), true);
assert.equal(isCursorAuthDiscoverableProduct("Code"), false);
assert.equal(isCursorAuthDiscoverableProduct("VSCodium"), false);
assert.equal(isCursorAuthDiscoverableProduct("RandomFork"), false);

const previousIncludeDcursor = process.env.CCM_INCLUDE_DCURSOR;
const previousDiscoverProducts = process.env.CCM_DISCOVER_PRODUCTS;
try {
  delete process.env.CCM_INCLUDE_DCURSOR;
  delete process.env.CCM_DISCOVER_PRODUCTS;

  assert.equal(shouldDiscoverProductInstall("dCursor", "dCursor"), true);
  assert.equal(shouldDiscoverProductInstall("Cursor", "Cursor"), true);
  assert.equal(shouldDiscoverProductInstall("Code", "Visual Studio Code"), false);
  assert.equal(shouldDiscoverProductInstall("Windsurf", "Cursor"), true);
  assert.equal(shouldDiscoverProductInstall("RandomFork", "Cursor"), false);

  process.env.CCM_INCLUDE_DCURSOR = "1";
  assert.equal(shouldDiscoverProductInstall("dCursor", "Cursor"), true);

  process.env.CCM_DISCOVER_PRODUCTS = "Cursor,Windsurf";
  assert.equal(isCursorAuthDiscoverableProduct("Windsurf"), true);
  assert.equal(isCursorAuthDiscoverableProduct("dCursor"), false);
} finally {
  if (previousIncludeDcursor === undefined) {
    delete process.env.CCM_INCLUDE_DCURSOR;
  } else {
    process.env.CCM_INCLUDE_DCURSOR = previousIncludeDcursor;
  }
  if (previousDiscoverProducts === undefined) {
    delete process.env.CCM_DISCOVER_PRODUCTS;
  } else {
    process.env.CCM_DISCOVER_PRODUCTS = previousDiscoverProducts;
  }
}

withIsolatedHome(path.join(__dirname, "mock-home-dcursor-only"), (auth) => {
  const dcursorDb = path.join(
    process.env.HOME,
    ".config",
    "dCursor",
    "User",
    "globalStorage",
    "state.vscdb"
  );
  fs.mkdirSync(path.dirname(dcursorDb), { recursive: true });
  fs.writeFileSync(dcursorDb, "dcursor-only");

  const previousIncludeDcursor = process.env.CCM_INCLUDE_DCURSOR;
  try {
    delete process.env.CCM_INCLUDE_DCURSOR;
    assert.equal(auth.shouldDiscoverProductInstall("dCursor", "Cursor"), true);
    assert.equal(auth.shouldDiscoverProductInstall("dCursor", "dCursor"), true);
    assert.equal(auth.resolveProductDataFolder("Cursor"), "dCursor");
  } finally {
    if (previousIncludeDcursor === undefined) {
      delete process.env.CCM_INCLUDE_DCURSOR;
    } else {
      process.env.CCM_INCLUDE_DCURSOR = previousIncludeDcursor;
    }
  }
});

withIsolatedHome(path.join(__dirname, "mock-home-both-cursor"), (auth) => {
  for (const product of ["Cursor", "dCursor"]) {
    const dbPath = path.join(
      process.env.HOME,
      ".config",
      product,
      "User",
      "globalStorage",
      "state.vscdb"
    );
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, product);
  }

  const previousIncludeDcursor = process.env.CCM_INCLUDE_DCURSOR;
  try {
    delete process.env.CCM_INCLUDE_DCURSOR;
    assert.equal(auth.shouldDiscoverProductInstall("dCursor", "Cursor"), false);
    assert.equal(auth.shouldDiscoverProductInstall("dCursor", "dCursor"), true);
    assert.equal(auth.resolveProductDataFolder("Cursor"), "Cursor");
  } finally {
    if (previousIncludeDcursor === undefined) {
      delete process.env.CCM_INCLUDE_DCURSOR;
    } else {
      process.env.CCM_INCLUDE_DCURSOR = previousIncludeDcursor;
    }
  }
});

console.log("discover-products test passed");
