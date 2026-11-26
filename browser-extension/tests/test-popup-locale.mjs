import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolvePopupMessage } from "../src/popup/messages.ts";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const en = readJson("../public/_locales/en/messages.json");
const bn = readJson("../public/_locales/bn/messages.json");
const manifest = readJson("../manifest.json");
const popup = readFileSync(new URL("../src/popup/App.tsx", import.meta.url), "utf8");

assert.equal(manifest.default_locale, "en");
assert.deepEqual(Object.keys(bn).sort(), Object.keys(en).sort());
for (const key of Object.keys(en)) {
  assert.ok(bn[key].message.trim());
  assert.notEqual(bn[key].message, en[key].message);
  assert.equal(resolvePopupMessage(key, (name) => bn[name]?.message ?? ""), bn[key].message);
  assert.equal(resolvePopupMessage(key, () => ""), en[key].message);
  assert.ok(popup.includes('popupText("' + key + '")'), key + " is not wired into the popup");
}
console.log("test-popup-locale.mjs: OK");
