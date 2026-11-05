/**
 * Safe GITHUB_ENV writes for CI — register ::add-mask:: before values can appear in logs.
 */
import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

/**
 * Scalar GITHUB_ENV encoding (GitHub Actions file format).
 * @param {string} value
 */
export function encodeGithubEnvScalar(value) {
  return String(value).replace(/%/g, "%25");
}

/**
 * @param {string} value
 */
export function maskSecretForGithubActions(value) {
  if (!value || process.env.GITHUB_ACTIONS !== "true") return;
  const str = String(value);
  process.stdout.write(`::add-mask::${str}\n`);
  const encoded = encodeGithubEnvScalar(str);
  if (encoded !== str) {
    process.stdout.write(`::add-mask::${encoded}\n`);
  }
  for (const line of str.split(/\r?\n/)) {
    if (line.length > 0) {
      process.stdout.write(`::add-mask::${line}\n`);
    }
  }
}

/**
 * @param {string} name
 * @param {string} value
 * @param {{ sensitive?: boolean }} [opts]
 */
export function exportEnvToGithub(name, value, opts = {}) {
  if (value == null || value === "") return;
  const str = String(value);
  const sensitive = opts.sensitive !== false;
  if (sensitive) {
    maskSecretForGithubActions(str);
  }

  const file = process.env.GITHUB_ENV;
  if (!file) {
    if (sensitive) {
      console.log(`::notice::local dry-run: would set ${name} (${str.length} chars, redacted)`);
    } else {
      console.log(`::notice::local dry-run: would set ${name}=${str}`);
    }
    return;
  }

  // Sensitive values always use delimiter syntax — avoids %25 scalar writes that bypass masking.
  if (sensitive || str.includes("\n") || str.includes("\r")) {
    const delimiter = `gha_env_${randomUUID()}`;
    appendFileSync(file, `${name}<<${delimiter}\n${str}\n${delimiter}\n`);
    return;
  }

  appendFileSync(file, `${name}=${encodeGithubEnvScalar(str)}\n`);
}
