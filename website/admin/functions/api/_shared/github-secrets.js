import nacl from "tweetnacl";
import { githubFetch } from "./github.js";
import { GITHUB_REPO } from "./repo-constants.js";

export const DEFAULT_GITHUB_SECRETS_ENV = "admin-production";

/**
 * @param {string} publicKeyBase64
 * @param {string} secretValue
 */
export function encryptGithubSecret(publicKeyBase64, secretValue) {
  const keyBytes = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0));
  const messageBytes = new TextEncoder().encode(secretValue);
  const sealed = nacl.seal(messageBytes, keyBytes);
  let binary = "";
  for (let i = 0; i < sealed.length; i += 1) {
    binary += String.fromCharCode(sealed[i]);
  }
  return btoa(binary);
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} secretName
 * @param {string} secretValue
 * @param {{ repo?: string; environment?: string }} [options]
 */
export async function setGithubEnvironmentSecret(env, secretName, secretValue, options = {}) {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured on Mission Control");
  }
  const repo = options.repo ?? GITHUB_REPO;
  const environment = options.environment ?? DEFAULT_GITHUB_SECRETS_ENV;
  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    throw new Error(`Invalid repository: ${repo}`);
  }

  const pkRes = await githubFetch(
    `/repos/${owner}/${repoName}/environments/${encodeURIComponent(environment)}/secrets/public-key`,
    env
  );
  if (!pkRes.ok) {
    const detail = await pkRes.text();
    throw new Error(`GitHub public key fetch failed (${pkRes.status}): ${detail.slice(0, 200)}`);
  }
  const publicKey = await pkRes.json();
  const encryptedValue = encryptGithubSecret(publicKey.key, secretValue);

  const putRes = await githubFetch(
    `/repos/${owner}/${repoName}/environments/${encodeURIComponent(environment)}/secrets/${encodeURIComponent(secretName)}`,
    env,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encrypted_value: encryptedValue,
        key_id: publicKey.key_id,
      }),
    }
  );
  if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
    const detail = await putRes.text();
    throw new Error(`GitHub secret ${secretName} update failed (${putRes.status}): ${detail.slice(0, 200)}`);
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, string>} secrets
 * @param {{ repo?: string; environment?: string }} [options]
 */
export async function setGithubEnvironmentSecrets(env, secrets, options = {}) {
  const entries = Object.entries(secrets).filter(([, value]) => value != null && String(value).length > 0);
  const results = [];
  for (const [name, value] of entries) {
    await setGithubEnvironmentSecret(env, name, String(value), options);
    results.push(name);
  }
  return results;
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ repo?: string; environment?: string }} [options]
 */
export async function listGithubEnvironmentSecretNames(env, options = {}) {
  const repo = options.repo ?? GITHUB_REPO;
  const environment = options.environment ?? DEFAULT_GITHUB_SECRETS_ENV;
  const [owner, repoName] = repo.split("/");
  const res = await githubFetch(
    `/repos/${owner}/${repoName}/environments/${encodeURIComponent(environment)}/secrets?per_page=100`,
    env
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.secrets ?? []).map((s) => s.name);
}
