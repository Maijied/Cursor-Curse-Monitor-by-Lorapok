import assert from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const whatsNewPath = join(root, "src", "components", "WhatsNewCard.tsx");
const storagePath = join(root, "src", "lib", "storage.ts");
const appPath = join(root, "src", "popup", "App.tsx");

const whatsNew = readFileSync(whatsNewPath, "utf8");
const storage = readFileSync(storagePath, "utf8");
const app = readFileSync(appPath, "utf8");

assert(whatsNew.includes("What&apos;s new"), "WhatsNewCard must include heading");
assert(whatsNew.includes("__RELEASE_NOTES__"), "WhatsNewCard must use release notes define");
assert(storage.includes("lastSeenVersion"), "storage must track lastSeenVersion");
assert(app.includes("WhatsNewCard"), "popup must render WhatsNewCard");
assert(app.includes("lastSeenVersion"), "popup must compare lastSeenVersion");

console.log("test_whats_new.js: OK");
