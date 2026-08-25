import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLACEHOLDER = "0.0.0";

export function readRootPackageVersion(repoRoot) {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  return String(pkg.version ?? PLACEHOLDER);
}

export function resolveExtensionVersion(browserRoot = join(dirname(fileURLToPath(import.meta.url)), "..")) {
  const repoRoot = join(browserRoot, "..");
  const browserPkg = JSON.parse(readFileSync(join(browserRoot, "package.json"), "utf8"));
  const rootVersion = readRootPackageVersion(repoRoot);
  const local = String(browserPkg.version ?? PLACEHOLDER);
  if (local && local !== PLACEHOLDER) return local;
  return rootVersion;
}
