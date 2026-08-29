/** Create scoped Cloudflare API tokens for Mission Control mail (no logging secrets). */

export async function createMailToken(oauth, accountId) {
  const pgRes = await fetch(
    "https://api.cloudflare.com/client/v4/user/tokens/permission_groups",
    { headers: { Authorization: `Bearer ${oauth}` } }
  );
  const pgJson = await pgRes.json();
  if (!pgRes.ok) {
    throw new Error(`permission_groups ${pgRes.status}: ${JSON.stringify(pgJson.errors)}`);
  }

  const names = new Set([
    "Email Sending Send",
    "Email Sending Write",
    "Workers Scripts Edit",
    "Workers Scripts Read",
    "Cloudflare Pages Write",
    "Pages Write",
    "Account Settings Read",
  ]);
  const groups = pgJson.result.filter((g) => names.has(g.name));
  if (!groups.length) {
    throw new Error("No matching permission groups found");
  }

  const tokenBody = {
    name: `ccm-mail-${Date.now()}`,
    policies: [
      {
        effect: "allow",
        resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
        permission_groups: groups.map((g) => ({ id: g.id })),
      },
    ],
  };

  const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${oauth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tokenBody),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(`create token ${res.status}: ${JSON.stringify(json.errors)}`);
  }
  return json.result.value;
}

export async function probe(token, accountId) {
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
        from: { address: "cursor-contact@lorapok.tech", name: "CCM Setup" },
        subject: "CCM mail token configured",
        text: "Cloudflare Email Sending is now wired for Mission Control.",
      }),
    }
  );
  const body = await res.json().catch(() => ({}));
  return { status: res.status, success: body.success, errors: body.errors };
}
