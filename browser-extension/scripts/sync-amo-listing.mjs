#!/usr/bin/env node
/**
 * PATCH AMO listing (homepage, support, description, tags, categories, icon) via API v5.
 * Usage:
 *   AMO_JWT_ISSUER=... AMO_JWT_SECRET=... node sync-amo-listing.mjs
 *   AMO_JWT_ISSUER=... AMO_JWT_SECRET=... node sync-amo-listing.mjs --icon=dist/icons/icon-128.png
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const slug = "cursor-curse-monitor";
const issuer = process.env.AMO_JWT_ISSUER || process.env.AMO_API_KEY;
const secret = process.env.AMO_JWT_SECRET || process.env.AMO_API_SECRET;

const base = JSON.parse(readFileSync(join(root, "amo", "amo-metadata.base.json"), "utf8"));

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
    console.error(`PATCH failed HTTP ${res.status}:`, text.slice(0, 800));
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
    console.error(`Icon PATCH failed HTTP ${res.status}:`, (await res.text()).slice(0, 800));
    process.exit(1);
  }
  return res.json();
}

const iconArg = process.argv.find((a) => a.startsWith("--icon="))?.split("=")[1];

console.log("Syncing AMO listing for", slug);

const payload = {
  summary: base.summary,
  description: base.description,
  homepage: base.homepage,
  support_url: base.support_url,
  support_email: base.support_email,
  developer_comments: base.developer_comments,
  categories: base.categories,
  tags: base.tags,
};

const data = await patchJson(payload);
console.log("Homepage:", data.homepage?.["en-US"]?.url || data.homepage?.["en-US"]);
console.log("Support URL:", data.support_url?.["en-US"]?.url || data.support_url?.["en-US"]);
console.log("Support email:", data.support_email?.["en-US"]);
console.log("Tags:", data.tags);
console.log("Categories:", data.categories);

const iconPath = iconArg
  ? iconArg.startsWith("/")
    ? iconArg
    : join(root, iconArg)
  : join(root, "dist", "icons", "icon-128.png");

if (existsSync(iconPath)) {
  console.log("Uploading icon:", iconPath);
  await patchIcon(iconPath);
  console.log("Icon upload submitted (AMO may resize asynchronously)");
} else {
  console.warn("Icon not found at", iconPath, "— run npm run build -w browser-extension first");
}

console.log("Done — verify at https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor/");
console.log("Ownership (license/EULA): https://addons.mozilla.org/en-US/developers/addon/cursor-curse-monitor/ownership");
