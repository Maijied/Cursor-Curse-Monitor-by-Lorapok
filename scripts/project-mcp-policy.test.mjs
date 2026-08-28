import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateProjectMcp } from "./project-mcp-policy.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("project MCP policy", () => {
  it("accepts the committed Cloudflare-only config", () => {
    const config = JSON.parse(readFileSync(join(root, ".cursor", "mcp.json"), "utf8"));
    assert.deepEqual(validateProjectMcp(config), []);
  });

  it("rejects a home-directory filesystem server", () => {
    const violations = validateProjectMcp({
      mcpServers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/maizied"],
        },
      },
    });
    assert.ok(violations.some((item) => item.includes("filesystem")));
  });

  it("rejects a PAT in a query string", () => {
    const violations = validateProjectMcp({
      mcpServers: {
        artiforge: {
          url: "https://tools.artiforge.ai/mcp?pat=secret",
        },
      },
    });
    assert.ok(violations.some((item) => item.includes("query string") || item.includes("artiforge")));
  });

  it("rejects unpinned @latest launchers", () => {
    const violations = validateProjectMcp({
      mcpServers: {
        browsermcp: {
          command: "npx",
          args: ["-y", "@browsermcp/mcp@latest"],
        },
      },
    });
    assert.ok(violations.length > 0);
  });
});
