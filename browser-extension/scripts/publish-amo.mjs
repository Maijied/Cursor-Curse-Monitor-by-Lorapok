#!/usr/bin/env node
/**
 * Sign and submit the browser extension to Firefox AMO (listed channel).
 * Mirrors lorapok-atlas-firefox CI flow with CCM amo-metadata generation.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveExtensionVersion } from "./lib-version.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(root, "..");

const issuer = process.env.AMO_JWT_ISSUER || process.env.AMO_API_KEY;
const secret = process.env.AMO_JWT_SECRET || process.env.AMO_API_SECRET;
const version =
  process.env.RELEASE_VERSION ||
  process.argv.find((a) => a.startsWith("--version="))?.split("=")[1] ||
  resolveExtensionVersion(root);

if (!issuer || !secret) {
  console.error("::error::AMO_JWT_ISSUER and AMO_JWT_SECRET (or AMO_API_KEY / AMO_API_SECRET) are required");
  process.exit(1);
}

if (!issuer.startsWith("user:")) {
  console.error(
    "::error::AMO_JWT_ISSUER must be a JWT issuer (user:…). Regenerate at https://addons.mozilla.org/developers/addon/api/key/"
  );
  process.exit(1);
}

if (!existsSync(join(root, "dist", "manifest.json"))) {
  console.error("::error::browser-extension/dist missing — run npm run browser-ext:build first");
  process.exit(1);
}

const amoDir = join(root, "amo");
mkdirSync(amoDir, { recursive: true });

const screenshotSrc = join(repoRoot, "website/assets/marketing/showcase-browser-ext.png");
for (const name of ["screenshot-1280x800.png", "screenshot-640x480.png"]) {
  const dest = join(amoDir, name);
  if (!existsSync(dest) && existsSync(screenshotSrc)) {
    copyFileSync(screenshotSrc, dest);
    console.log(`Prepared ${name} from marketing asset`);
  }
}

function run(cmd, args, extraEnv = {}) {
  execFileSync(cmd, args, {
    stdio: "inherit",
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
  });
}

console.log(`Publishing Firefox AMO build for version ${version}`);
run("node", ["browser-extension/scripts/generate-amo-metadata.mjs", `--version=${version}`]);
run("node", ["browser-extension/scripts/validate-amo-metadata.mjs"]);

mkdirSync(join(root, "artifacts/firefox"), { recursive: true });

try {
  run("npx", [
    "web-ext@8",
    "sign",
    "--source-dir",
    "browser-extension/dist",
    "--artifacts-dir",
    "browser-extension/artifacts/firefox",
    "--channel",
    "listed",
    "--amo-metadata",
    "browser-extension/amo/amo-metadata.generated.json",
    "--api-key",
    issuer,
    "--api-secret",
    secret,
  ]);
} catch (error) {
  console.error("::error::web-ext sign failed — check AMO credentials and listing metadata");
  throw error;
}

run("node", ["browser-extension/scripts/verify-amo-status.mjs"], {
  AMO_JWT_ISSUER: issuer,
  AMO_JWT_SECRET: secret,
  RELEASE_VERSION: version,
});

console.log("AMO publish pipeline completed");
