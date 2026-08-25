#!/usr/bin/env node
/**
 * Sync AMO JWT credentials from secure cred vault to GitHub repo secrets.
 * Requires: gpg, jq, gh CLI. Set CRED_PASSPHRASE in env (non-interactive).
 * Never prints secret values.
 */
import { execFileSync } from "node:child_process";

const REPO = process.env.GITHUB_REPO || "Maijied/Cursor-Curse-Monitor-by-Lorapok";
const STORE_FILE =
  process.env.CRED_STORE_FILE || "/mnt/NewVolume/Personal_Projects/cred/credentials.json.gpg";

function loadVault() {
  const pass = process.env.CRED_PASSPHRASE;
  if (!pass) return null;
  try {
    const json = execFileSync(
      "gpg",
      [
        "--batch",
        "--quiet",
        "--yes",
        "--pinentry-mode",
        "loopback",
        "--passphrase-fd",
        "0",
        "-d",
        STORE_FILE,
      ],
      { encoding: "utf8", input: `${pass}\n` }
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function credGet(category, key) {
  if (process.env[`AMO_${key.toUpperCase()}`]) {
    return process.env[`AMO_${key.toUpperCase()}`];
  }
  const envMap = {
    jwt_issuer: process.env.AMO_JWT_ISSUER,
    jwt_secret: process.env.AMO_JWT_SECRET,
  };
  if (envMap[key]) return envMap[key];

  const vault = loadVault();
  if (!vault) {
    try {
      return execFileSync("cred", ["get", category, key], {
        encoding: "utf8",
        env: process.env,
      }).trim();
    } catch {
      return "";
    }
  }
  return String(vault[category]?.[key] ?? "").trim();
}

function ghSecretSet(name, value) {
  execFileSync("gh", ["secret", "set", name, "--repo", REPO, "--body", value], {
    stdio: ["pipe", "inherit", "inherit"],
  });
  console.log(`GitHub secret ${name} updated`);
}

const issuer = credGet("firefox", "jwt_issuer");
const secret = credGet("firefox", "jwt_secret");

if (!issuer || !secret) {
  console.error("::error::AMO credentials missing (firefox/jwt_issuer, firefox/jwt_secret)");
  process.exit(1);
}

if (!issuer.startsWith("user:")) {
  console.error(
    "::error::firefox/jwt_issuer must be a JWT issuer (user:…), not legacy API key format"
  );
  process.exit(1);
}

ghSecretSet("AMO_JWT_ISSUER", issuer);
ghSecretSet("AMO_JWT_SECRET", secret);
console.log("AMO GitHub secrets synced (values not logged)");
