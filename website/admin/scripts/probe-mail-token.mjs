#!/usr/bin/env node
/** Probe mail token without printing secrets. */
import { spawnSync } from "node:child_process";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";

function wranglerToken() {
  const r = spawnSync("npx", ["wrangler", "auth", "token", "--json"], {
    encoding: "utf8",
    cwd: new URL("..", import.meta.url).pathname,
  });
  if (r.status !== 0) {
    console.error("wrangler auth token failed");
    process.exit(1);
  }
  const text = `${r.stdout}\n${r.stderr}`;
  const match = text.match(/\{[\s\S]*"token"[\s\S]*\}/);
  if (!match) {
    console.error("wrangler auth token: no JSON in output");
    process.exit(1);
  }
  return JSON.parse(match[0]);
}

async function probe(token, label) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: "admin@lorapok.tech",
        from: { address: "cursor-contact@lorapok.tech", name: "CCM Probe" },
        subject: `mail probe ${label}`,
        text: "probe",
      }),
    }
  );
  const body = await res.json().catch(() => ({}));
  console.log(
    JSON.stringify({
      label,
      status: res.status,
      success: body.success,
      result: body.result,
      errors: body.errors?.map((e) => ({ code: e.code, message: e.message })),
    })
  );
}

async function listDomains(token) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/domains`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const body = await res.json().catch(() => ({}));
  console.log(
    JSON.stringify({
      listStatus: res.status,
      domains: body.result?.map((d) => ({ name: d.name ?? d.domain, status: d.status })),
      errors: body.errors,
    })
  );
}

const { type, token } = wranglerToken();
console.log(JSON.stringify({ tokenType: type, tokenLen: token?.length }));
await listDomains(token);
await probe(token, "oauth");
