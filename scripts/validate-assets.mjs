#!/usr/bin/env node
/**
 * Validates extension + website icon/logo assets before commit or release.
 * Run: npm run validate:assets
 */
import { readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`❌ ${msg}`);
  errors++;
}
function warn(msg) {
  console.warn(`⚠️  ${msg}`);
  warnings++;
}
function ok(msg) {
  console.log(`✓ ${msg}`);
}

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function sha256(rel) {
  const buf = readFileSync(join(root, rel));
  return createHash("sha256").update(buf).digest("hex");
}

function pngDimensions(rel) {
  const buf = readFileSync(join(root, rel));
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function checkExists(rel, label) {
  if (!existsSync(join(root, rel))) {
    fail(`Missing ${label}: ${rel}`);
    return false;
  }
  ok(`Found ${label}: ${rel}`);
  return true;
}

function checkSvg(rel, { viewBox, mustHave = [], mustNotHave = [], label }) {
  if (!checkExists(rel, label)) return;
  const svg = read(rel);
  if (!svg.includes("<svg")) fail(`${rel} is not valid SVG`);
  if (viewBox && !svg.includes(`viewBox="${viewBox}"`)) {
    fail(`${rel} must have viewBox="${viewBox}"`);
  }
  for (const token of mustHave) {
    if (!svg.includes(token)) fail(`${rel} missing required: ${token}`);
  }
  for (const token of mustNotHave) {
    if (svg.includes(token)) fail(`${rel} must not contain: ${token}`);
  }
  if (svg.includes('width="128" height="128" fill="#')) {
    warn(`${rel} may have opaque background`);
  }
}

function checkPng(rel, { minSize = 64, maxBytes = 3_000_000, label }) {
  if (!checkExists(rel, label)) return;
  const size = statSync(join(root, rel)).size;
  const dim = pngDimensions(rel);
  if (!dim) {
    fail(`${rel} is not a valid PNG`);
    return;
  }
  if (dim.width < minSize || dim.height < minSize) {
    fail(`${rel} should be at least ${minSize}x${minSize}, got ${dim.width}x${dim.height}`);
  }
  if (size > maxBytes) {
    warn(`${rel} is large (${(size / 1024 / 1024).toFixed(2)} MB) — consider optimizing`);
  } else {
    ok(`${rel} ${dim.width}x${dim.height} (${(size / 1024).toFixed(0)} KB)`);
  }
}

console.log("==> Validating icon & logo assets\n");

// Required SVG assets
checkSvg("media/activity-bar.svg", {
  viewBox: "0 0 24 24",
  mustHave: ["currentColor", "<svg"],
  label: "activity bar icon (SVG)",
});
checkSvg("media/logo.svg", {
  viewBox: "0 0 128 128",
  mustHave: ["<animate", "eye-glow", "pupil"],
  mustNotHave: ['fill="#fff"', 'width="128" height="128" fill'],
  label: "animated logo (SVG)",
});
checkSvg("media/extension-icon.svg", {
  viewBox: "0 0 128 128",
  mustHave: ["<svg"],
  label: "IDE extension marketplace icon (SVG)",
});
checkSvg("media/icon.svg", {
  viewBox: "0 0 128 128",
  mustHave: ["<svg"],
  label: "website/marketing icon (SVG)",
});

// Marketplace PNGs
checkPng("media/extension-icon.png", { label: "IDE extension icon (PNG)" });
checkPng("media/icon.png", { label: "website icon (PNG)" });
checkPng("media/logo.png", { label: "dashboard logo fallback (PNG)", minSize: 64 });

// package.json references
const pkg = JSON.parse(read("package.json"));
const refs = [
  ["package icon", pkg.icon],
  ["activity bar", pkg.contributes?.viewsContainers?.activitybar?.[0]?.icon],
];
for (const [label, rel] of refs) {
  if (!rel) {
    fail(`package.json missing ${label} path`);
    continue;
  }
  if (!existsSync(join(root, rel))) {
    fail(`package.json ${label} points to missing file: ${rel}`);
  } else if (rel.endsWith(".svg") && label.includes("activity")) {
    ok(`package.json ${label} → ${rel}`);
  } else if (rel.endsWith(".png")) {
    ok(`package.json ${label} → ${rel}`);
  }
}

// Website sync
if (checkExists("website/assets/icon.png", "website favicon")) {
  const mediaHash = sha256("media/icon.png");
  const webHash = sha256("website/assets/icon.png");
  if (mediaHash !== webHash) {
    warn("website/assets/icon.png is out of sync with media/icon.png — run npm run sync:icons");
  } else {
    ok("website icon in sync with media/icon.png");
  }
}

if (existsSync(join(root, "website/assets/logo.svg"))) {
  const a = sha256("media/logo.svg");
  const b = sha256("website/assets/logo.svg");
  if (a !== b) warn("website/assets/logo.svg out of sync — run npm run sync:icons");
  else ok("website logo.svg in sync");
}

console.log(`\n==> Done: ${errors} error(s), ${warnings} warning(s)`);
if (errors > 0) process.exit(1);
if (warnings > 0) process.exit(0);
