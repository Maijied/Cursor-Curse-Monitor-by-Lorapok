import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SiteData } from "../lib/site-data";

const siteDataPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../site-data.json"
);

export function loadSiteDataFixture(): SiteData {
  return JSON.parse(readFileSync(siteDataPath, "utf8")) as SiteData;
}
