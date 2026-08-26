/**
 * Lorapok mail credential split (see loragent-cloudflare-mail-master skill).
 *
 * - CLOUDFLARE_API_TOKEN — Pages/Workers deploy only (wrangler)
 * - CLOUDFLARE_EMAIL_API_TOKEN — Email Sending REST only (Pages secret + probes)
 *
 * Never fall back from email token to deploy token for outbound mail.
 */

const DEFAULT_ACCOUNT_ID = "f049faaf2f67549f5c58837479596a4a";

export function resolveMailCredentials(env = process.env) {
  const accountId = (env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID).trim();
  const deployToken = (env.CLOUDFLARE_API_TOKEN ?? "").trim();
  const emailToken = (env.CLOUDFLARE_EMAIL_API_TOKEN ?? "").trim();

  return { accountId, deployToken, emailToken };
}

export function requireDeployToken(env = process.env) {
  const { deployToken, accountId } = resolveMailCredentials(env);
  if (!deployToken) {
    throw new Error(
      "Set CLOUDFLARE_API_TOKEN (Cloudflare Pages + Workers deploy). Load via: export CLOUDFLARE_API_TOKEN=\"$(cred get cursor cloudflare_api_token)\""
    );
  }
  return { deployToken, accountId };
}

export function requireEmailToken(env = process.env) {
  const { emailToken, accountId } = resolveMailCredentials(env);
  if (!emailToken) {
    throw new Error(
      "Set CLOUDFLARE_EMAIL_API_TOKEN (Account → Email Sending → Edit). Never use CLOUDFLARE_API_TOKEN for mail sends. Load via: export CLOUDFLARE_EMAIL_API_TOKEN=\"$(cred get cursor cloudflare_email_api_token)\""
    );
  }
  return { emailToken, accountId };
}

/**
 * Probe Email Sending API with the dedicated email token.
 * @returns {Promise<{ ok: boolean; status: number; body: unknown }>}
 */
export async function probeEmailSendingToken(emailToken, accountId) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/domains`,
    { headers: { Authorization: `Bearer ${emailToken}` } }
  );
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.success !== false, status: res.status, body };
}
