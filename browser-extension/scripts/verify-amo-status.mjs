#!/usr/bin/env node
/**
 * Poll AMO API for add-on version status after web-ext sign.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const slug = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1]
  || "cursor-curse-monitor-by-lorapok";
const issuer = process.env.AMO_JWT_ISSUER;
const secret = process.env.AMO_JWT_SECRET;

if (!issuer || !secret) {
  console.error("AMO credentials are required for listing verification");
  process.exit(1);
}

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")
);
const expectedVersion = process.env.RELEASE_VERSION || pkg.version;

const jwtHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const payload = Buffer.from(
  JSON.stringify({ iss: issuer, jti: `${now}-${Math.random()}`, iat: now, exp: now + 300 })
).toString("base64url");
const crypto = await import("node:crypto");
const sig = crypto
  .createHmac("sha256", secret)
  .update(`${jwtHeader}.${payload}`)
  .digest("base64url");
const token = `${jwtHeader}.${payload}.${sig}`;

const url = `https://addons.mozilla.org/api/v5/addons/addon/${slug}/`;
const res = await fetch(url, {
  headers: { Authorization: `JWT ${token}`, Accept: "application/json" },
});

if (!res.ok) {
  console.error(`AMO verification failed: HTTP ${res.status} for ${slug}`);
  process.exit(1);
}

const data = await res.json();
const current = data.current_version?.version;
console.log(`AMO addon: ${data.name?.en-US || slug}`);
console.log(`Listed version: ${current || "pending"} (expected ${expectedVersion})`);
if (data.url) {
  console.log(`Public URL: ${data.url}`);
}
