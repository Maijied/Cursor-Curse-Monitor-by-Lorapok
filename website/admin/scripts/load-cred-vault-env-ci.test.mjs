import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  exportEnvToGithub,
  maskSecretForGithubActions,
} from "./lib/github-actions-env.mjs";

test("exportEnvToGithub registers add-mask and uses multiline delimiter", () => {
  const dir = mkdtempSync(join(tmpdir(), "gha-env-"));
  const envFile = join(dir, "env");
  const logs = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    logs.push(String(chunk));
    return true;
  };

  process.env.GITHUB_ACTIONS = "true";
  process.env.GITHUB_ENV = envFile;

  try {
    exportEnvToGithub("FIREBASE_SERVICE_ACCOUNT_JSON", '{"a":1,\n"b":2}');
    const body = readFileSync(envFile, "utf8");
    assert.match(body, /^FIREBASE_SERVICE_ACCOUNT_JSON<<gha_env_/m);
    assert.match(body, /"b":2/);
    assert.ok(logs.some((l) => l.includes("::add-mask::")));
    assert.ok(!logs.some((l) => l.startsWith("export ")));
  } finally {
    process.stdout.write = origWrite;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_ENV;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("maskSecretForGithubActions masks full value and each line", () => {
  const logs = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    logs.push(String(chunk));
    return true;
  };
  process.env.GITHUB_ACTIONS = "true";
  try {
    maskSecretForGithubActions("line1\nline2");
    assert.ok(logs.some((l) => l.trim() === "::add-mask::line1"));
    assert.ok(logs.some((l) => l.trim() === "::add-mask::line2"));
  } finally {
    process.stdout.write = origWrite;
    delete process.env.GITHUB_ACTIONS;
  }
});

test("exportEnvToGithub uses delimiter for sensitive single-line values (incl. percent)", () => {
  const dir = mkdtempSync(join(tmpdir(), "gha-env-"));
  const envFile = join(dir, "env");
  process.env.GITHUB_ACTIONS = "true";
  process.env.GITHUB_ENV = envFile;

  try {
    exportEnvToGithub("TEST_SECRET", "token%with%percent", { sensitive: true });
    const body = readFileSync(envFile, "utf8");
    assert.match(body, /^TEST_SECRET<<gha_env_/m);
    assert.match(body, /token%with%percent/);
    assert.doesNotMatch(body, /^TEST_SECRET=token%25/m);
  } finally {
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_ENV;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("maskSecretForGithubActions masks percent-encoded scalar form", () => {
  const logs = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    logs.push(String(chunk));
    return true;
  };
  process.env.GITHUB_ACTIONS = "true";
  try {
    maskSecretForGithubActions("a%b");
    assert.ok(logs.some((l) => l.trim() === "::add-mask::a%b"));
    assert.ok(logs.some((l) => l.trim() === "::add-mask::a%25b"));
  } finally {
    process.stdout.write = origWrite;
    delete process.env.GITHUB_ACTIONS;
  }
});
