/**
 * Resend domain verification helpers (MAIL-07).
 */

export const DEFAULT_SENDING_DOMAIN = "mail.lorapok.tech";

/** DNS record names under zone lorapok.tech for mail.lorapok.tech Resend setup. */
export const EXPECTED_DNS_NAMES = [
  "resend._domainkey.mail",
  "send.mail",
  "mail",
];

/**
 * @param {string} status
 */
export function isResendDomainVerified(status) {
  const normalized = String(status ?? "").toLowerCase();
  return normalized === "verified" || normalized === "partially_verified";
}

/**
 * @param {unknown} domain
 */
export function summarizeResendDomain(domain) {
  if (!domain || typeof domain !== "object") return null;
  const d = /** @type {Record<string, unknown>} */ (domain);
  const records = Array.isArray(d.records) ? d.records : [];
  return {
    id: String(d.id ?? ""),
    name: String(d.name ?? ""),
    status: String(d.status ?? "unknown"),
    region: String(d.region ?? ""),
    verified: isResendDomainVerified(d.status),
    records: records.map((r) => {
      const row = /** @type {Record<string, unknown>} */ (r);
      return {
        record: String(row.record ?? ""),
        name: String(row.name ?? ""),
        type: String(row.type ?? ""),
        status: String(row.status ?? ""),
        value: String(row.value ?? "").slice(0, 80),
      };
    }),
  };
}

export function normalizeCloudflareDnsName(name) {
  return String(name ?? "").trim().toLowerCase().replace(/\.lorapok\.tech$/, "");
}

/**
 * @param {Array<{ name?: string; type?: string; content?: string; proxied?: boolean }>} dnsRows
 * @param {string} [domain]
 */
export function auditCloudflareDns(dnsRows, domain = DEFAULT_SENDING_DOMAIN) {
  const subdomain = domain.replace(/\.lorapok\.tech$/, "");
  const byName = new Map();
  for (const row of dnsRows) {
    const key = normalizeCloudflareDnsName(row.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  }

  const checks = [];
  const want = [
    { name: `resend._domainkey.${subdomain}`, types: ["TXT"] },
    { name: `send.${subdomain}`, types: ["MX", "TXT"] },
    { name: subdomain, types: ["MX"] },
  ];

  for (const item of want) {
    const rows = byName.get(item.name) ?? [];
    const foundTypes = new Set(rows.map((r) => String(r.type ?? "").toUpperCase()));
    const missing = item.types.filter((t) => !foundTypes.has(t));
    const proxied = rows.some((r) => r.proxied === true);
    checks.push({
      name: item.name,
      ok: missing.length === 0,
      missing,
      proxied,
      count: rows.length,
    });
  }

  return {
    ok: checks.every((c) => c.ok) && checks.every((c) => !c.proxied),
    checks,
  };
}

/**
 * @param {string} apiKey
 * @param {typeof fetch} [fetchFn]
 */
export async function listResendDomains(apiKey, fetchFn = fetch) {
  const res = await fetchFn("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend domains list failed (${res.status}): ${body.message ?? JSON.stringify(body)}`);
  }
  const data = Array.isArray(body.data) ? body.data : [];
  return data;
}

/**
 * @param {string} apiKey
 * @param {string} domainId
 * @param {typeof fetch} [fetchFn]
 */
export async function getResendDomain(apiKey, domainId, fetchFn = fetch) {
  const res = await fetchFn(`https://api.resend.com/domains/${domainId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend domain get failed (${res.status}): ${body.message ?? JSON.stringify(body)}`);
  }
  return body;
}

/**
 * @param {string} apiKey
 * @param {string} domainId
 * @param {typeof fetch} [fetchFn]
 */
export async function triggerResendDomainVerify(apiKey, domainId, fetchFn = fetch) {
  const res = await fetchFn(`https://api.resend.com/domains/${domainId}/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend verify failed (${res.status}): ${body.message ?? JSON.stringify(body)}`);
  }
  return body;
}

/**
 * @param {Record<string, string>} headers
 * @param {typeof fetch} [fetchFn]
 */
export async function resolveCloudflareZoneId(headers, fetchFn = fetch) {
  const res = await fetchFn("https://api.cloudflare.com/client/v4/zones?name=lorapok.tech", {
    headers,
  });
  const body = await res.json().catch(() => ({}));
  const zone = body?.result?.[0];
  return zone?.id ? String(zone.id) : null;
}

/**
 * @param {Record<string, string>} headers
 * @param {string} zoneId
 * @param {typeof fetch} [fetchFn]
 */
export async function listCloudflareDns(headers, zoneId, fetchFn = fetch) {
  const res = await fetchFn(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`,
    {
      headers,
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(`Cloudflare DNS list failed (${res.status})`);
  }
  return Array.isArray(body.result) ? body.result : [];
}

/**
 * @param {{
 *   apiKey: string;
 *   cfHeaders?: Record<string, string>;
 *   zoneId?: string;
 *   resolveZone?: boolean;
 *   domain?: string;
 *   verify?: boolean;
 *   fetchFn?: typeof fetch;
 * }} options
 */
export async function runResendDomainVerification(options) {
  const domain = String(options.domain ?? DEFAULT_SENDING_DOMAIN).trim().toLowerCase();
  const fetchFn = options.fetchFn ?? fetch;
  const checks = [];
  const pass = (name, detail) => checks.push({ name, ok: true, detail });
  const fail = (name, detail) => checks.push({ name, ok: false, detail });

  let domains = [];
  try {
    domains = await listResendDomains(options.apiKey, fetchFn);
    pass("resend-api", `${domains.length} domain(s) in account`);
  } catch (err) {
    fail("resend-api", err instanceof Error ? err.message : "Resend API failed");
    return { ok: false, domain, checks, summary: summarizeResendDomain(null) };
  }

  const match = domains.find((d) => String(d.name ?? "").toLowerCase() === domain);
  if (!match) {
    fail("resend-domain", `Domain ${domain} not found — add at https://resend.com/domains`);
    return { ok: false, domain, checks, summary: null };
  }

  let detail = match;
  try {
    detail = await getResendDomain(options.apiKey, String(match.id), fetchFn);
  } catch (err) {
    fail("resend-domain-detail", err instanceof Error ? err.message : "get domain failed");
  }

  const summary = summarizeResendDomain(detail);
  if (summary?.verified) {
    pass("resend-status", `${domain} is ${summary.status}`);
  } else {
    fail("resend-status", `${domain} is ${summary?.status ?? "unknown"} — verify DNS in Resend dashboard`);
  }

  if (summary && !summary.verified && options.verify === true && summary.id) {
    try {
      await triggerResendDomainVerify(options.apiKey, summary.id, fetchFn);
      pass("resend-verify-trigger", "POST /domains/:id/verify sent");
      const refreshed = await getResendDomain(options.apiKey, summary.id, fetchFn);
      const next = summarizeResendDomain(refreshed);
      if (next?.verified) {
        pass("resend-status-after-verify", `${domain} is now ${next.status}`);
      } else {
        fail("resend-status-after-verify", `still ${next?.status ?? "unknown"} — wait for DNS propagation`);
      }
      Object.assign(summary, next ?? {});
    } catch (err) {
      fail("resend-verify-trigger", err instanceof Error ? err.message : "verify POST failed");
    }
  }

  if (options.cfHeaders && (options.zoneId || options.resolveZone)) {
    try {
      const zoneId =
        options.zoneId ||
        (options.resolveZone ? await resolveCloudflareZoneId(options.cfHeaders, fetchFn) : null);
      if (!zoneId) {
        fail("cloudflare-dns", "could not resolve lorapok.tech zone id");
      } else {
      const rows = await listCloudflareDns(options.cfHeaders, zoneId, fetchFn);
      const relevant = rows
        .filter((r) => {
          const name = normalizeCloudflareDnsName(r.name);
          return EXPECTED_DNS_NAMES.some((n) => name === n || name.endsWith(`.${n}`));
        })
        .map((r) => ({
          name: normalizeCloudflareDnsName(r.name),
          type: String(r.type ?? ""),
          content: String(r.content ?? ""),
          proxied: r.proxied === true,
        }));
      const audit = auditCloudflareDns(relevant, domain);
      if (audit.ok) {
        pass("cloudflare-dns", "resend._domainkey.mail, send.mail, mail MX present (DNS only)");
      } else {
        for (const row of audit.checks) {
          if (!row.ok) {
            fail(`dns-${row.name}`, `missing types: ${row.missing.join(", ") || "records"}`);
          } else if (row.proxied) {
            fail(`dns-${row.name}`, "must be DNS only (grey cloud) — disable proxy");
          }
        }
      }
      }
    } catch (err) {
      fail("cloudflare-dns", err instanceof Error ? err.message : "DNS audit failed");
    }
  } else {
    checks.push({
      name: "cloudflare-dns",
      ok: true,
      detail: "skipped — set Cloudflare DNS creds (global API key or zone-read token)",
      skipped: true,
    });
  }

  const failed = checks.filter((c) => c.ok === false);
  return {
    ok: failed.length === 0 && Boolean(summary?.verified),
    domain,
    checks,
    summary,
  };
}
