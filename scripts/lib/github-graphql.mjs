#!/usr/bin/env node
/** Shared GitHub GraphQL helper for project scripts. */
import { spawnSync } from "node:child_process";

export function ghGraphql(query, variables = {}) {
  const input = JSON.stringify({ query, variables });
  const result = spawnSync("gh", ["api", "graphql", "--input", "-"], {
    encoding: "utf8",
    input,
    env: process.env,
  });
  if ((result.status ?? 1) !== 0) {
    return { ok: false, error: result.stderr || result.stdout };
  }
  try {
    const parsed = JSON.parse(result.stdout);
    if (parsed.errors?.length) return { ok: false, error: JSON.stringify(parsed.errors) };
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, error: result.stdout };
  }
}
