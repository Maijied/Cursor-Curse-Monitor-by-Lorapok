#!/usr/bin/env node
/**
 * Copy @lorapok/cursor-monitor-shared into vendor/ for VSIX packaging (vsce skips node_modules).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sharedRoot = join(root, "packages/shared");
const sharedDist = join(sharedRoot, "dist/index.js");
const dest = join(root, "vendor/cursor-monitor-shared");

if (!existsSync(sharedDist)) {
  console.error("::error::packages/shared/dist missing — run npm run compile first.");
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(join(sharedRoot, "dist"), join(dest, "dist"), { recursive: true });

const sharedPkg = JSON.parse(readFileSync(join(sharedRoot, "package.json"), "utf8"));
const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
writeFileSync(
  join(dest, "package.json"),
  `${JSON.stringify(
    {
      name: sharedPkg.name,
      version: rootPkg.version,
      main: sharedPkg.main,
      types: sharedPkg.types,
    },
    null,
    2
  )}\n`
);

console.log("Staged vendor/cursor-monitor-shared for VSIX packaging.");
