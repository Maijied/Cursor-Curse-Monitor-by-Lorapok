import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeVersion } from "../../scripts/compute-version.mjs";

const PLACEHOLDER = "0.0.0";

export function readRootPackageVersion(repoRoot) {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  return String(pkg.version ?? PLACEHOLDER);
}

export function resolveExtensionVersion(browserRoot = join(dirname(fileURLToPath(import.meta.url)), "..")) {
  const repoRoot = join(browserRoot, "..");
  const browserPkg = JSON.parse(readFileSync(join(browserRoot, "package.json"), "utf8"));
  const local = String(browserPkg.version ?? PLACEHOLDER);
  if (local && local !== PLACEHOLDER) return local.split("-")[0];
  const rootVersion = readRootPackageVersion(repoRoot);
  if (rootVersion && rootVersion !== PLACEHOLDER) return rootVersion.split("-")[0];
  return computeVersion().split("-")[0];
}
