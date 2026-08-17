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
  console.log("AMO credentials not set — skipping verify");
  process.exit(0);
}

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")
);

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
  console.warn(`AMO verify: HTTP ${res.status} for ${slug} (may be first listing)`);
  process.exit(0);
}

const data = await res.json();
const current = data.current_version?.version;
console.log(`AMO addon: ${data.name?.en-US || slug}`);
console.log(`Listed version: ${current || "pending"} (package ${pkg.version})`);
if (data.url) {
  console.log(`Public URL: ${data.url}`);
}
