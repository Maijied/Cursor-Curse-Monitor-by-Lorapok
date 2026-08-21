export interface AdminSecurityFinding {
  id: string;
  location: string;
  kind: string;
  severity: "high" | "medium";
}

const PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: "API key", re: /\b(?:ghp_[A-Za-z0-9]{36,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/ },
  { kind: "Bearer token", re: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/ },
  { kind: "Private key", re: /-----BEGIN (?:RSA )?PRIVATE KEY-----/ },
];

export function scanAdminText(text: string, location: string): AdminSecurityFinding[] {
  const findings: AdminSecurityFinding[] = [];
  let n = 0;
  for (const { kind, re } of PATTERNS) {
    if (re.test(text)) {
      n += 1;
      findings.push({
        id: `adm-${n}`,
        location,
        kind,
        severity: "high",
      });
    }
  }
  return findings;
}
