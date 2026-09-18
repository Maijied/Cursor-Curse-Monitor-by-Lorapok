/**
 * ECO-08 — admin ConfirmActionHost + confirmAction wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "website/admin/src/App.tsx"), "utf8");
const host = readFileSync(join(root, "website/admin/src/components/ui/ConfirmActionHost.tsx"), "utf8");
const deployments = readFileSync(join(root, "website/admin/src/components/pages/Deployments.tsx"), "utf8");
const notices = readFileSync(join(root, "website/admin/src/components/pages/Notices.tsx"), "utf8");
const extension = readFileSync(join(root, "src/extension.ts"), "utf8");

assert.match(app, /ConfirmActionHost/);
assert.match(host, /setConfirmHandler/);
assert.match(deployments, /confirmAction\(/);
assert.match(notices, /confirmAction\(/);
assert.doesNotMatch(notices, /window\.confirm/);
assert.match(extension, /setConfirmHandler/);

console.log("test_eco_08_confirm_action.mjs: OK");
