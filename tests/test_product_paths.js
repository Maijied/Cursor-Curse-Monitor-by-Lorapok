const assert = require("assert");
const path = require("path");
const os = require("os");

require("ts-node").register({ transpileOnly: true });
const {
  resolveProductDataFolder,
  getCursorGlobalStoragePath,
} = require("../src/cursorAuth.ts");

function withPlatform(platform, fn) {
  const original = process.platform;
  Object.defineProperty(process, "platform", { value: platform });
  try {
    fn();
  } finally {
    Object.defineProperty(process, "platform", { value: original });
  }
}

assert.strictEqual(resolveProductDataFolder("Cursor"), "Cursor");
assert.strictEqual(resolveProductDataFolder("Visual Studio Code"), "Code");
assert.strictEqual(resolveProductDataFolder("Windsurf"), "Windsurf");
assert.strictEqual(resolveProductDataFolder("VSCodium"), "VSCodium");

withPlatform("darwin", () => {
  const windsurfPath = getCursorGlobalStoragePath(undefined, "Windsurf");
  assert.ok(
    windsurfPath.includes(path.join("Application Support", "Windsurf")),
    `expected macOS Windsurf path, got ${windsurfPath}`
  );
});

withPlatform("win32", () => {
  const cursorPath = getCursorGlobalStoragePath("cursor");
  assert.ok(cursorPath.includes(path.join("Cursor", "User", "globalStorage")), cursorPath);
});

withPlatform("linux", () => {
  const codePath = getCursorGlobalStoragePath("vscode");
  assert.ok(codePath.includes(path.join(".config", "Code")), codePath);
});

console.log("product-paths test passed");
