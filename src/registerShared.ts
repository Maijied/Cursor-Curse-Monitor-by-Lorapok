/**
 * Packaged VSIX ships shared code under vendor/ (vsce excludes node_modules).
 * Dev installs still resolve via the workspace symlink in node_modules.
 */
import { existsSync } from "node:fs";
import Module from "node:module";
import { join } from "node:path";

const vendorShared = join(
  __dirname,
  "..",
  "vendor",
  "cursor-monitor-shared",
  "dist",
  "index.js"
);

type ResolveFilename = (
  request: string,
  parent: Module | undefined,
  isMain: boolean,
  options?: unknown
) => string;

const moduleHost = Module as typeof Module & {
  _resolveFilename: ResolveFilename;
};

if (existsSync(vendorShared)) {
  const originalResolve = moduleHost._resolveFilename;
  moduleHost._resolveFilename = function patchedResolve(
    request,
    parent,
    isMain,
    options
  ) {
    if (request === "@lorapok/cursor-monitor-shared") {
      return vendorShared;
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
}
