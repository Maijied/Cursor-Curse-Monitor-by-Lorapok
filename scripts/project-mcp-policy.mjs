#!/usr/bin/env node
/**
 * Committed project MCP must stay Cloudflare-only (no filesystem, PATs in URLs,
 * or unpinned npx servers). Used by governance hooks, import:agents, and tests.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_HOSTS = new Set([
  "mcp.cloudflare.com",
  "docs.mcp.cloudflare.com",
  "bindings.mcp.cloudflare.com",
  "builds.mcp.cloudflare.com",
  "observability.mcp.cloudflare.com",
]);

export function validateProjectMcp(config) {
  const violations = [];
  const servers = config?.mcpServers;
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) {
    violations.push("mcpServers must be an object");
    return violations;
  }

  for (const [name, server] of Object.entries(servers)) {
    if (!String(name).startsWith("cloudflare")) {
      violations.push(`${name}: only Cloudflare MCP servers are allowed in committed project config`);
    }
    if (!server || typeof server !== "object") {
      violations.push(`${name}: server entry must be an object`);
      continue;
    }
    if (server.command || server.args) {
      violations.push(`${name}: command/args MCP servers are not allowed in project config`);
    }
    const serialized = JSON.stringify(server);
    if (serialized.includes("@latest") || serialized.includes("npx")) {
      violations.push(`${name}: unpinned npx/@latest MCP launchers are not allowed`);
    }
    if (typeof server.url !== "string") {
      violations.push(`${name}: missing https url`);
      continue;
    }
    let parsed;
    try {
      parsed = new URL(server.url);
    } catch {
      violations.push(`${name}: invalid url`);
      continue;
    }
    if (parsed.protocol !== "https:") {
      violations.push(`${name}: url must be https`);
    }
    if (parsed.search) {
      violations.push(`${name}: url must not include a query string`);
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      violations.push(`${name}: host ${parsed.hostname} is not an allowlisted Cloudflare MCP host`);
    }
  }

  return violations;
}

export function readProjectMcp(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const invokedDirectly = /project-mcp-policy\.mjs$/.test(process.argv[1] ?? "");
if (invokedDirectly) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const mcpPath = join(root, ".cursor", "mcp.json");
  const violations = validateProjectMcp(readProjectMcp(mcpPath));
  if (violations.length) {
    console.error("project MCP policy failed:");
    for (const item of violations) console.error(`  - ${item}`);
    process.exit(1);
  }
  console.log("project MCP policy passed (Cloudflare-only)");
}
