#!/usr/bin/env node
/** Fast admin build only — no live site-data/SEO network fetches. */
import { resolveLocalMailEnv } from "./lib/resolve-local-mail-env.mjs";
import { adminDir, buildAdminFast, ensureAdminDeps } from "./lib/deploy-fast.mjs";

ensureAdminDeps(resolveLocalMailEnv(process.env, adminDir));
buildAdminFast(resolveLocalMailEnv(process.env, adminDir));
console.log("✓ dist/ ready — run: npm run deploy:fast -- --skip-build");
