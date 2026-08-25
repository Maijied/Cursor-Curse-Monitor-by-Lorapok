#!/usr/bin/env node
/**
 * Sync AMO JWT credentials from secure cred vault to GitHub repo secrets.
 * Requires: cred CLI, gh CLI, CRED_PASSPHRASE in env.
 * Never prints secret values.
 */
import { execFileSync } from "node:child_process";

const REPO = process.env.GITHUB_REPO || "Maijied/Cursor-Curse-Monitor-by-Lorapok";

function credGet(category, key) {
  return execFileSync("cred", ["get", category, key], {
    encoding: "utf8",
    env: process.env,
  }).trim();
}

function ghSecretSet(name, value) {
  execFileSync("gh", ["secret", "set", name, "--repo", REPO, "--body", value], {
    stdio: ["pipe", "inherit", "inherit"],
  });
  console.log(`GitHub secret ${name} updated`);
}

const issuer =
  process.env.AMO_JWT_ISSUER ||
  credGet("firefox", "jwt_issuer");
const secret =
  process.env.AMO_JWT_SECRET ||
  credGet("firefox", "jwt_secret");

if (!issuer || !secret) {
  console.error("::error::AMO credentials missing in vault (firefox/jwt_issuer, firefox/jwt_secret)");
  process.exit(1);
}

ghSecretSet("AMO_JWT_ISSUER", issuer);
ghSecretSet("AMO_JWT_SECRET", secret);
console.log("AMO GitHub secrets synced (values not logged)");
