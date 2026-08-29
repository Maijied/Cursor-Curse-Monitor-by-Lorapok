import assert from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const popup = readFileSync(join(root, "src", "popup", "App.tsx"), "utf8");
const options = readFileSync(join(root, "src", "options", "OptionsApp.tsx"), "utf8");
const storage = readFileSync(join(root, "src", "lib", "storage.ts"), "utf8");
const worker = readFileSync(join(root, "src", "background", "service-worker.ts"), "utf8");

assert(popup.includes("Switch Cursor account"), "popup must expose an account switcher");
assert(popup.includes("setActiveAccount"), "popup must switch the active saved account");
assert(options.includes("Saved Cursor accounts"), "options must list saved accounts");
assert(options.includes("Add another account"), "options must allow adding another login");
assert(storage.includes("accounts"), "storage must persist multiple accounts");
assert(storage.includes("migrateLegacyToken"), "storage must migrate the previous single token");
assert(storage.includes("cursor-curse-monitor@lorapok.tech"), "storage must recognize production Firefox extension id");
assert(worker.includes("saveToken"), "captured dashboard tokens must upsert a saved account");
assert(!storage.includes("console.log"), "storage must not log settings");

console.log("test_accounts.js: OK");
