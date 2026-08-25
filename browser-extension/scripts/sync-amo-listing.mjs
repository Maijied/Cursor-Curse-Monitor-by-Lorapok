#!/usr/bin/env node
/**
 * PATCH AMO listing URLs (homepage, support_url) via API v5.
 * Usage:
 *   AMO_JWT_ISSUER=... AMO_JWT_SECRET=... node sync-amo-listing.mjs
 *   AMO_JWT_ISSUER=... AMO_JWT_SECRET=... node sync-amo-listing.mjs --icon=dist/icons/icon-128.png
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const slug = "cursor-curse-monitor";
const issuer = process.env.AMO_JWT_ISSUER || process.env.AMO_API_KEY;
const secret = process.env.AMO_JWT_SECRET || process.env.AMO_API_SECRET;

const HOMEPAGE = "https://cursor.lorapok.tech/";
const SUPPORT_URL = "https://cursor.lorapok.tech/";
const SUPPORT_EMAIL = "cursor.curse.help@lorapok.tech";

if (!issuer || !secret) {
  console.error("AMO_JWT_ISSUER and AMO_JWT_SECRET required");
  process.exit(1);
}

async function jwtToken() {
  const crypto = await import("node:crypto");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: issuer, jti: `${now}-${Math.random()}`, iat: now, exp: now + 300 })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

async function patchJson(body) {
  const token = await jwtToken();
  const res = await fetch(`https://addons.mozilla.org/api/v5/addons/addon/${slug}/`, {
    method: "PATCH",
    headers: {
      Authorization: `JWT ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`PATCH failed HTTP ${res.status}:`, text.slice(0, 500));
    process.exit(1);
  }
  return JSON.parse(text);
}

async function patchIcon(iconPath) {
  const token = await jwtToken();
  const form = new FormData();
  const buf = readFileSync(iconPath);
  form.append("icon", new Blob([buf], { type: "image/png" }), "icon-128.png");
  const res = await fetch(`https://addons.mozilla.org/api/v5/addons/addon/${slug}/`, {
    method: "PATCH",
    headers: { Authorization: `JWT ${token}` },
    body: form,
  });
  if (!res.ok) {
    console.error(`Icon PATCH failed HTTP ${res.status}:`, (await res.text()).slice(0, 500));
    process.exit(1);
  }
  return res.json();
}

const iconArg = process.argv.find((a) => a.startsWith("--icon="))?.split("=")[1];

console.log("Updating AMO listing URLs for", slug);
const data = await patchJson({
  homepage: { "en-US": HOMEPAGE },
  support_url: { "en-US": SUPPORT_URL },
  support_email: { "en-US": SUPPORT_EMAIL },
});
console.log("Homepage:", data.homepage?.["en-US"]?.url || data.homepage?.["en-US"]);
console.log("Support URL:", data.support_url?.["en-US"]?.url || data.support_url?.["en-US"]);
console.log("Support email:", data.support_email?.["en-US"]);

if (iconArg) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const path = iconArg.startsWith("/") ? iconArg : join(root, iconArg);
  if (!existsSync(path)) {
    console.error("Icon not found:", path);
    process.exit(1);
  }
  console.log("Uploading icon:", path);
  await patchIcon(path);
  console.log("Icon upload submitted (resizing may be async on AMO)");
}

console.log("Done — verify at https://addons.mozilla.org/en-US/developers/addon/cursor-curse-monitor/edit");
