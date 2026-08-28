#!/usr/bin/env node
/**
 * Fast local Mission Control deploy — no live site-data fetches, no mail setup.
 *
 * Typical time: ~1–3 min (vs repair-mail ~5–10+ min with network prebuild + mail).
 *
 * Prerequisites (once):
 *   cd website/admin && npx wrangler login
 *
 * Usage:
 *   node website/admin/scripts/deploy-pages-fast.mjs
 *   node website/admin/scripts/deploy-pages-fast.mjs --preview
 *   npm run deploy:fast --prefix website/admin
 *
 * Auth: .cred-vault-passphrase at repo root OR wrangler OAuth (no cred CLI).
 */
import { spawnSync } from "node:child_process";
import { resolveLocalMailEnv } from "./lib/resolve-local-mail-env.mjs";
import { requireDeployToken } from "./lib/mail-credentials.mjs";
import {
  FAST_DEPLOY_TARGET,
  adminDir,
  buildAdminFast,
  deployAdminPagesFast,
  ensureAdminDeps,
  repoRoot,
} from "./lib/deploy-fast.mjs";

const args = process.argv.slice(2);
const preview = args.includes("--preview");
const skipBuild = args.includes("--skip-build");

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "preview";
}

console.log("⚡ Fast deploy — skips live site-data/SEO + mail setup\n");

const mailEnv = resolveLocalMailEnv(process.env, adminDir);

try {
  requireDeployToken(mailEnv);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  console.error("\nRun once: cd website/admin && npx wrangler login");
  process.exit(1);
}

ensureAdminDeps(mailEnv);

if (!skipBuild) {
  buildAdminFast(mailEnv);
} else {
  console.log("Skipping build (--skip-build)…");
}

const previewBranch = preview ? `preview-${gitShortSha()}` : null;
deployAdminPagesFast({ previewBranch, env: mailEnv });

console.log("\n✓ Fast deploy complete.");
if (previewBranch) {
  console.log(`  Preview branch: ${previewBranch}`);
  console.log("  Check Cloudflare Pages dashboard for preview URL.");
} else {
  console.log(`  ${FAST_DEPLOY_TARGET}`);
  console.log("  Mission Control → hard refresh (Ctrl+Shift+R) if UI looks stale.");
}
