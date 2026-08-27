import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { API_CATALOG } from "./api-catalog";

const adminSrc = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(adminSrc, "../../functions/api");

function listApiFunctionFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith("_")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      listApiFunctionFiles(full, acc);
      continue;
    }
    if (name.endsWith(".ts")) acc.push(full);
  }
  return acc;
}

function fileToRoute(file: string): string {
  return `/${relative(apiRoot, file).replace(/\\/g, "/").replace(/\.ts$/, "")}`;
}

describe("API_CATALOG", () => {
  it("covers every Pages Function route", () => {
    const routes = listApiFunctionFiles(apiRoot).map(fileToRoute);
    const catalogPaths = new Set(API_CATALOG.map((entry) => entry.path.split("?")[0]));
    const missing = routes.filter((route) => !catalogPaths.has(route));
    expect(missing, `API Explorer missing: ${missing.join(", ")}`).toEqual([]);
  });

  it("uses unique ids", () => {
    const ids = API_CATALOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
