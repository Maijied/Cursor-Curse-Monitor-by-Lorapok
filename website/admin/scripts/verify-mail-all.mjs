#!/usr/bin/env node
/**
 * MAIL-06 — run the local outbound/inbound mail verify suite (no deploy).
 *
 *   cd website/admin && npm run mail:verify-all
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLocalMailEnvAsync } from "./lib/resolve-local-mail-env.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mailEnv = await resolveLocalMailEnvAsync(process.env, adminDir);

const steps = [
  { id: "setup", script: "verify-mail-setup.mjs", allowFail: true },
  { id: "transport", script: "verify-mail-transport.mjs", allowFail: false },
  { id: "inbound", script: "verify-inbound-routing.mjs", allowFail: false },
  { id: "resend-domain", script: "verify-resend-domain.mjs", allowFail: false },
  { id: "production", script: "probe-mail-production.mjs", allowFail: false },
];

let failed = 0;
for (const step of steps) {
  console.log(`\n── ${step.id}: ${step.script} ──`);
  const result = spawnSync(process.execPath, [resolve(adminDir, "scripts", step.script)], {
    cwd: adminDir,
    env: mailEnv,
    stdio: "inherit",
  });
  const code = result.status ?? 1;
  if (code !== 0) {
    if (step.allowFail) {
      console.warn(`⚠ ${step.id} exited ${code} (non-blocking)`);
    } else {
      console.error(`✗ ${step.id} exited ${code}`);
      failed += 1;
    }
  } else {
    console.log(`✓ ${step.id}`);
  }
}

if (failed > 0) {
  console.error(`\nMAIL-06 verify-all: ${failed} hard failure(s).`);
  process.exit(1);
}

console.log("\nMAIL-06 OK — mail verify suite green.");
