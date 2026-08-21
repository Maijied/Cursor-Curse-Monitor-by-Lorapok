#!/usr/bin/env node
// Attach a custom domain to a Cloudflare Pages project using the local
// wrangler OAuth session. The access token is only held in memory and is
// never written to stdout/stderr.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT = process.env.PAGES_PROJECT;
const DOMAIN = process.env.PAGES_DOMAIN;

if (!ACCOUNT_ID || !PROJECT || !DOMAIN) {
  console.error("Set CLOUDFLARE_ACCOUNT_ID, PAGES_PROJECT, PAGES_DOMAIN");
  process.exit(2);
}

function readWranglerToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const cfg = join(homedir(), ".config", ".wrangler", "config", "default.toml");
  const text = readFileSync(cfg, "utf8");
  const match = text.match(/^\s*oauth_token\s*=\s*"([^"]+)"/m);
  if (!match) throw new Error("no oauth_token in wrangler config; run `wrangler login`");
  return match[1];
}

const token = readWranglerToken();

async function api(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  let body;
  try {
    body = await res.json();
  } catch {
    body = { success: false, errors: [{ message: `non-JSON response ${res.status}` }] };
  }
  return { status: res.status, body };
}

const zoneName = DOMAIN.split(".").slice(-2).join(".");

const zones = await api(`/zones?name=${encodeURIComponent(zoneName)}`);
const zone = (zones.body.result || [])[0];
console.log(
  JSON.stringify(
    {
      step: "lookup-zone",
      zoneName,
      found: Boolean(zone),
      zoneId: zone?.id,
      zoneAccountId: zone?.account?.id,
      zoneAccountName: zone?.account?.name,
      sameAccountAsPages: zone?.account?.id === ACCOUNT_ID,
      errors: zones.body.errors,
    },
    null,
    2,
  ),
);

const existing = await api(`/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/domains`);
console.log(
  JSON.stringify(
    {
      step: "existing-domains",
      domains: (existing.body.result || []).map((d) => ({ name: d.name, status: d.status })),
      errors: existing.body.errors,
    },
    null,
    2,
  ),
);

if ((existing.body.result || []).some((d) => d.name === DOMAIN)) {
  console.log(JSON.stringify({ step: "add-domain", skipped: "already attached" }, null, 2));
} else {
  const added = await api(`/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: DOMAIN }),
  });
  console.log(
    JSON.stringify(
      {
        step: "add-domain",
        status: added.status,
        success: added.body.success,
        domain: added.body.result?.name,
        domainStatus: added.body.result?.status,
        errors: added.body.errors,
      },
      null,
      2,
    ),
  );
}

// The CNAME must target this project's own *.pages.dev hostname, which may
// carry a suffix when the bare subdomain is taken by another account.
const projectInfo = await api(`/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`);
const pagesHost = projectInfo.body.result?.subdomain || `${PROJECT}.pages.dev`;
console.log(JSON.stringify({ step: "pages-host", pagesHost }, null, 2));

if (zone?.id && zone.account?.id === ACCOUNT_ID) {
  const recs = await api(
    `/zones/${zone.id}/dns_records?name=${encodeURIComponent(DOMAIN)}`,
  );
  const found = (recs.body.result || []).map((r) => ({
    type: r.type,
    name: r.name,
    content: r.content,
    proxied: r.proxied,
  }));
  console.log(JSON.stringify({ step: "dns-check", records: found, errors: recs.body.errors }, null, 2));

  if (found.length === 0) {
    const created = await api(`/zones/${zone.id}/dns_records`, {
      method: "POST",
      body: JSON.stringify({
        type: "CNAME",
        name: DOMAIN,
        content: pagesHost,
        proxied: true,
        comment: "Pages custom domain for admin panel",
      }),
    });
    console.log(
      JSON.stringify(
        {
          step: "dns-create",
          status: created.status,
          success: created.body.success,
          record: created.body.result
            ? { type: created.body.result.type, name: created.body.result.name, content: created.body.result.content }
            : undefined,
          errors: created.body.errors,
        },
        null,
        2,
      ),
    );
  }
}
