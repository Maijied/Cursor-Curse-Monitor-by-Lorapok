#!/usr/bin/env node
/**
 * Load procedure/project.json (tracked, no secrets).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const configPath = resolve(repoRoot, "procedure/project.json");

/** @returns {{ owner: string; repo: string; projectNumber: number | null; projectUrl: string | null; defaultLabels: string[] }} */
export function loadProcedureConfig() {
  const raw = JSON.parse(readFileSync(configPath, "utf8"));
  return {
    owner: String(raw.owner ?? "Maijied"),
    repo: String(raw.repo ?? "Cursor-Curse-Monitor-by-Lorapok"),
    projectNumber: raw.projectNumber == null ? null : Number(raw.projectNumber),
    projectUrl: raw.projectUrl ? String(raw.projectUrl) : null,
    defaultLabels: Array.isArray(raw.defaultLabels) ? raw.defaultLabels.map(String) : ["task"],
  };
}

export function repoRootPath() {
  return repoRoot;
}

export function procedureDir() {
  return resolve(repoRoot, "procedure");
}

/** @param {string} title */
export function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** @param {number} [bytes] */
export function shortId(bytes = 4) {
  return crypto.randomUUID().replace(/-/g, "").slice(0, bytes * 2);
}
