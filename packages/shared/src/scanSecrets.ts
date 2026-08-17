import type { ScanSecretsOptions, SecurityFinding, SecurityFindingKind, SecuritySeverity } from "./securityTypes";

const PLACEHOLDER_RE = /^(changeme|your[_-]?|example|xxx+|test|dummy|placeholder|redacted|insert[_-]?here|todo)$/i;

const RULES: Array<{
  kind: SecurityFindingKind;
  severity: SecuritySeverity;
  pattern: RegExp;
  label: string;
}> = [
  {
    kind: "private_key",
    severity: "high",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    label: "Private key",
  },
  {
    kind: "bearer_token",
    severity: "high",
    pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/,
    label: "Bearer token",
  },
  {
    kind: "jwt",
    severity: "high",
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    label: "JWT",
  },
  {
    kind: "api_key",
    severity: "high",
    pattern: /\b(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36,}|gho_[A-Za-z0-9]{36,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/,
    label: "API key",
  },
  {
    kind: "password",
    severity: "medium",
    pattern: /(?:password|api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*['"]?([^\s'"]{8,})['"]?/i,
    label: "Credential assignment",
  },
];

const SENSITIVE_FILENAMES = /\.(pem|p12|pfx|key|env|credentials\.json)$/i;

let idCounter = 0;

export function redactSnippet(value: string, maxLen = 32): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 12) return "••••••••";
  const head = trimmed.slice(0, 4);
  const tail = trimmed.slice(-4);
  const mid = trimmed.length > maxLen ? "…" : "";
  return `${head}${mid}…${tail}`;
}

function isPlaceholder(value: string): boolean {
  const v = value.trim();
  if (v.length < 8) return true;
  if (PLACEHOLDER_RE.test(v)) return true;
  if (/^<[^>]+>$/.test(v)) return true;
  return false;
}

function findingId(): string {
  idCounter += 1;
  return `sec-${idCounter}`;
}

function lineColumnAt(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  return { line: lines.length, column: (lines[lines.length - 1]?.length ?? 0) + 1 };
}

export function scanSecrets(text: string, options: ScanSecretsOptions = {}): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const location = options.location ?? "unknown";
  const seen = new Set<string>();

  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const raw = match[1] ?? match[0];
      if (isPlaceholder(raw)) continue;
      if (
        options.allowCursorToken &&
        options.context === "paste" &&
        (rule.kind === "bearer_token" || rule.kind === "jwt")
      ) {
        continue;
      }
      const key = `${rule.kind}:${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const pos = lineColumnAt(text, match.index);
      findings.push({
        id: findingId(),
        kind: rule.kind,
        location: options.location
          ? `${location}${pos.line ? `:${pos.line}` : ""}`
          : location,
        snippet: redactSnippet(raw),
        severity: rule.severity,
        line: pos.line,
        column: pos.column,
      });
    }
  }

  if (SENSITIVE_FILENAMES.test(location) && options.context !== "paste") {
    const envPair = /^\s*([A-Z0-9_]+)\s*=\s*(.+)$/gm;
    let m: RegExpExecArray | null;
    while ((m = envPair.exec(text)) !== null) {
      const val = m[2]?.trim() ?? "";
      if (!val || isPlaceholder(val) || val === '""' || val === "''") continue;
      const key = `env:${m.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const pos = lineColumnAt(text, m.index);
      findings.push({
        id: findingId(),
        kind: "password",
        location: `${location}:${pos.line}`,
        snippet: redactSnippet(val),
        severity: "high",
        line: pos.line,
        column: pos.column,
      });
    }
  }

  return findings;
}

export function scanSecretsInFiles(
  files: Array<{ path: string; content: string }>,
  options: Omit<ScanSecretsOptions, "location"> = {}
): SecurityFinding[] {
  const all: SecurityFinding[] = [];
  for (const file of files) {
    if (/node_modules|\.git|dist\/|\.vsix/.test(file.path)) continue;
    if (/\.(md|svg|png|jpg|woff2?)$/i.test(file.path) && options.context !== "workspace") continue;
    all.push(...scanSecrets(file.content, { ...options, location: file.path, context: "workspace" }));
  }
  return all;
}

export function hasHighSeverityFindings(findings: SecurityFinding[]): boolean {
  return findings.some((f) => f.severity === "high");
}
