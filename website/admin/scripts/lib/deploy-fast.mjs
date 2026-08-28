/**
 * Shared fast-build + fast-deploy helpers for local Mission Control iteration.
 * Skips live marketplace fetches and mail setup; uses committed site-data.json.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const libDir = dirname(fileURLToPath(import.meta.url));
const adminDir = resolve(libDir, "../..");
const repoRoot = resolve(adminDir, "../..");

export const FAST_DEPLOY_TARGET = "https://cursor-dev.lorapok.tech";
export const PAGES_PROJECT = "cursor-monitor-admin";

export function run(cmd, args, { cwd, env = process.env, allowFail = false } = {}) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env });
  if (result.status !== 0 && !allowFail) {
    process.exit(result.status ?? 1);
  }
  return result.status === 0;
}

/** Ensure workspace + admin node_modules link to @lorapok/cursor-monitor-shared. */
export function ensureAdminDeps(env = process.env) {
  const sharedLink = resolve(adminDir, "node_modules/@lorapok/cursor-monitor-shared");
  const sharedTypes = resolve(repoRoot, "packages/shared/dist/index.d.ts");
  if (existsSync(sharedLink) && existsSync(sharedTypes)) return false;

  console.log("Installing dependencies (@lorapok/cursor-monitor-shared link)…");
  run("npm", ["ci"], { cwd: repoRoot, env });
  run("npm", ["ci"], { cwd: adminDir, env });
  return true;
}

/**
 * Build admin dist without live site-data/SEO network fetches.
 * Uses committed website/site-data.json copied into dist by vite.config.ts.
 */
export function buildAdminFast(env = process.env) {
  const siteData = resolve(repoRoot, "website/site-data.json");
  if (!existsSync(siteData)) {
    console.error(`Missing ${siteData} — run: npm run site:data`);
    process.exit(1);
  }

  console.log("Fast build (shared + embed only — no live marketplace APIs)…");
  run("npm", ["run", "build", "-w", "@lorapok/cursor-monitor-shared"], { cwd: repoRoot, env });
  run(process.execPath, [resolve(repoRoot, "scripts/embed-product-context.mjs")], { cwd: repoRoot, env });
  run("npx", ["tsc", "-b"], { cwd: adminDir, env });
  run("npx", ["vite", "build"], { cwd: adminDir, env });

  const distIndex = resolve(adminDir, "dist/index.html");
  const distSiteData = resolve(adminDir, "dist/site-data.json");
  if (!existsSync(distIndex) || !existsSync(distSiteData)) {
    console.error("Build did not produce dist/index.html or dist/site-data.json");
    process.exit(1);
  }
}

/**
 * Deploy dist/ via deploy-pages-ci.mjs (retries, MAIL_RELAY guard, no mail setup).
 * @param {{ previewBranch?: string | null; env?: NodeJS.ProcessEnv }} opts
 */
export function deployAdminPagesFast({ previewBranch = null, env = process.env } = {}) {
  const deployEnv = {
    ...env,
    SKIP_MAIL_SETUP: "true",
    MAIL_RELAY_EXISTS_VERIFY: "true",
    CF_DEPLOY_PRE_COOLDOWN_SEC_LIGHT: env.CF_DEPLOY_PRE_COOLDOWN_SEC_LIGHT ?? "15",
  };

  if (previewBranch) {
    deployEnv.CF_PAGES_BRANCH = previewBranch;
  }

  console.log(
    previewBranch
      ? `Deploying preview branch "${previewBranch}" to Cloudflare Pages…`
      : `Deploying production admin to ${FAST_DEPLOY_TARGET}…`
  );

  const script = resolve(adminDir, "scripts/deploy-pages-ci.mjs");
  const result = spawnSync(process.execPath, [script], {
    cwd: adminDir,
    stdio: "inherit",
    env: deployEnv,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export { adminDir, repoRoot };
