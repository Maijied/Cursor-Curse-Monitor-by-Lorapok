#!/usr/bin/env node
/**
 * Deploy marketing site (website/) to Cloudflare Pages — private-repo path.
 * GitHub Pages is unavailable on private repos (free plan); use direct upload.
 *
 *   node scripts/deploy-marketing-pages.mjs
 *   node scripts/deploy-marketing-pages.mjs --project cursor-curse-monitor-website
 *
 * Requires Cloudflare deploy auth (cred vault or wrangler login).
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDeployAuth } from "../website/admin/scripts/lib/resolve-deploy-auth.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const adminDir = resolve(root, "website/admin");
const websiteDir = resolve(root, "website");

function parseArgs(argv) {
  let project = "cursor-curse-monitor-website";
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--project" && argv[i + 1]) project = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(`Usage: node scripts/deploy-marketing-pages.mjs [--project <name>]`);
      process.exit(0);
    }
  }
  return { project };
}

const { project } = parseArgs(process.argv);

console.log(`→ Cloudflare Pages deploy: ${project} (branch main)`);
const { wranglerEnv } = await resolveDeployAuth(adminDir);

const result = spawnSync(
  "npx",
  [
    "wrangler",
    "pages",
    "deploy",
    websiteDir,
    "--project-name",
    project,
    "--branch",
    "main",
    "--commit-dirty=true",
  ],
  {
    cwd: adminDir,
    env: wranglerEnv,
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`✓ Marketing site deployed to Cloudflare Pages project "${project}".`);
