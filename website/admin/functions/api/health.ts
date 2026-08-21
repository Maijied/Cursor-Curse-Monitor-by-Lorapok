import { jsonResponse } from "./_shared/auth.js";
import { githubFetch } from "./_shared/github.js";
import { getMailTransportStatus } from "./_shared/mail.js";

export async function onRequestGet(context) {
  const { env } = context;
  const checks = { github: false, timestamp: new Date().toISOString() };

  try {
    const res = await githubFetch("/zen", env);
    checks.github = res.ok;
  } catch {
    checks.github = false;
  }

  const mail = getMailTransportStatus(env);

  return jsonResponse({
    ok: checks.github,
    checks,
    firebaseProject: env.FIREBASE_PROJECT_ID ?? "cursor-curse-by-lorapok",
    githubTokenConfigured: Boolean(env.GITHUB_TOKEN),
    adminKvConfigured: Boolean(env.ADMIN_KV),
    mailConfigured: mail.configured,
    mailTransport: mail.transport,
    mailHint: mail.hint,
    adminPublicUrl: env.ADMIN_PUBLIC_URL ?? "https://cursor-dev.lorapok.tech",
    siteDataUrl:
      env.SITE_DATA_URL ??
      "https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/site-data.json",
  });
}
