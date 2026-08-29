#!/usr/bin/env node
/**
 * Lorapok Dependency Security Bot
 *
 * Project-owned alternative to Dependabot version updates. Implements concepts from
 * GitHub's "Managing security alerts" hub:
 * - Prioritize by severity and production vs development scope
 * - Filter dismissed alerts with audited reasons (dependency-security-dismissals.json)
 * - Surface fix availability (has:patch equivalent)
 * - Fail CI on thresholds; scheduled runs can open remediation PRs
 *
 * @see https://docs.github.com/en/code-security/how-tos/manage-security-alerts
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const SEVERITY_RANK = {
  critical: 4,
  high: 3,
  moderate: 2,
  low: 1,
  info: 0,
};

const DISMISSAL_REASONS = new Set([
  "fix_started",
  "inaccurate",
  "no_bandwidth",
  "tolerate_risk",
  "used_in_tests",
  "false_positive",
]);

/** Read and parse a JSON file, throwing when the path is missing. */
export function loadJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

/** True when `severity` is at or above the configured threshold rank. */
export function severityMeetsThreshold(severity, threshold) {
  return (SEVERITY_RANK[severity] ?? 0) >= (SEVERITY_RANK[threshold] ?? 0);
}

/** Collect advisory objects from npm audit `via` entries (excludes transitive name strings). */
export function extractAdvisoryEntries(via = []) {
  return via.filter((entry) => typeof entry === "object" && entry != null);
}

/** Extract GHSA ids and numeric advisory sources from npm audit `via` entries. */
export function extractAdvisoryIds(via) {
  const ids = new Set();
  for (const entry of via ?? []) {
    if (typeof entry === "string") continue;
    const url = entry.url ?? "";
    const ghsa = url.match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i);
    if (ghsa) ids.add(ghsa[0].toUpperCase());
    if (entry.source) ids.add(String(entry.source));
  }
  return [...ids];
}

function buildAlert({ workspace, scope, pkgName, detail, advisory, fixAvailable, fixVersion }) {
  const advisoryIds = advisory ? extractAdvisoryIds([advisory]) : extractAdvisoryIds(detail.via);
  const severity = String(advisory?.severity ?? detail.severity ?? "moderate").toLowerCase();

  return {
    id: advisoryIds[0] ?? `${workspace}:${pkgName}:${advisory?.range ?? detail.range ?? "unknown"}`,
    advisoryIds,
    workspace,
    scope,
    ecosystem: "npm",
    package: pkgName,
    severity,
    isDirect: Boolean(detail.isDirect),
    range: advisory?.range ?? detail.range ?? "",
    fixAvailable,
    fixVersion,
    title: advisory?.title ?? advisory?.name ?? detail.name ?? pkgName,
    url:
      advisory?.url ??
      "https://docs.npmjs.com/cli/v10/commands/npm-audit",
    priority: computePriority(severity, scope, fixAvailable),
  };
}

/** Normalize npm audit JSON into one alert per advisory (or per package when only transitive refs). */
export function parseNpmAuditReport(auditJson, { workspace, scope }) {
  const vulnerabilities = auditJson?.vulnerabilities ?? {};
  const alerts = [];

  for (const [pkgName, detail] of Object.entries(vulnerabilities)) {
    const fixAvailable = Boolean(
      detail.fixAvailable === true ||
        (detail.fixAvailable && typeof detail.fixAvailable === "object"),
    );
    const fixVersion =
      detail.fixAvailable && typeof detail.fixAvailable === "object"
        ? detail.fixAvailable.version
        : null;

    const advisoryEntries = extractAdvisoryEntries(detail.via);
    if (advisoryEntries.length === 0) {
      alerts.push(
        buildAlert({
          workspace,
          scope,
          pkgName,
          detail,
          advisory: null,
          fixAvailable,
          fixVersion,
        }),
      );
      continue;
    }

    for (const advisory of advisoryEntries) {
      alerts.push(
        buildAlert({
          workspace,
          scope,
          pkgName,
          detail,
          advisory,
          fixAvailable,
          fixVersion,
        }),
      );
    }
  }

  return alerts;
}

/** Rank alerts for remediation ordering (production + fixable + severity). */
export function computePriority(severity, scope, fixAvailable, config = {}) {
  const base = (SEVERITY_RANK[severity] ?? 0) * 10;
  const productionBoost = scope === "production" && config.prioritizeProduction !== false ? 5 : 0;
  const fixBoost = fixAvailable && config.boostWhenFixAvailable !== false ? 3 : 0;
  return base + productionBoost + fixBoost;
}

/** Return matching audited dismissal for an alert, or null when still open. */
export function isDismissed(alert, dismissals) {
  for (const dismissal of dismissals) {
    if (dismissal.workspace && dismissal.workspace !== alert.workspace) continue;

    if (dismissal.id) {
      const idMatch =
        dismissal.id === alert.id || alert.advisoryIds.includes(dismissal.id);
      if (!idMatch) continue;
      return dismissal;
    }

    if (dismissal.package && dismissal.package === alert.package) {
      if (dismissal.severity && dismissal.severity !== alert.severity) continue;
      return dismissal;
    }
  }
  return null;
}

/** Split alerts into open vs audited-dismissed buckets. */
export function triageAlerts(alerts, dismissals, config) {
  const autoTriage = config.autoTriage ?? {};
  const open = [];
  const dismissed = [];

  for (const alert of alerts) {
    const dismissal = isDismissed(alert, dismissals);
    if (dismissal) {
      dismissed.push({ ...alert, dismissal });
      continue;
    }
    open.push({
      ...alert,
      priority: computePriority(alert.severity, alert.scope, alert.fixAvailable, autoTriage),
    });
  }

  open.sort((a, b) => b.priority - a.priority || a.package.localeCompare(b.package));
  return { open, dismissed };
}

/** Reject npm error payloads and malformed audit JSON before triage. */
export function validateNpmAuditJson(auditJson, workspaceDir) {
  if (auditJson?.error) {
    const code = auditJson.error.code ?? "UNKNOWN";
    const summary = auditJson.error.summary ?? "npm audit failed";
    throw new Error(`npm audit error in ${workspaceDir} (${code}): ${summary}`);
  }
  if (auditJson?.vulnerabilities == null && auditJson?.metadata == null) {
    throw new Error(`npm audit returned unexpected JSON shape for ${workspaceDir}`);
  }
  return auditJson;
}

/** Run `npm audit --json` in a workspace and return validated report JSON. */
export function runNpmAudit(workspaceDir, { omitDev = false } = {}) {
  const args = ["audit", "--json"];
  if (omitDev) args.push("--omit=dev");

  const result = spawnSync("npm", args, {
    cwd: join(root, workspaceDir),
    encoding: "utf8",
    env: { ...process.env, npm_config_audit_level: "none" },
  });

  let auditJson = {};
  const stdout = result.stdout?.trim();
  if (stdout) {
    try {
      auditJson = JSON.parse(stdout);
    } catch {
      throw new Error(`npm audit returned invalid JSON for ${workspaceDir}`);
    }
    validateNpmAuditJson(auditJson, workspaceDir);
  } else if (result.status !== 0) {
    throw new Error(
      `npm audit failed in ${workspaceDir}: ${result.stderr || result.stdout || result.status}`,
    );
  }

  // npm audit exits 1 when vulnerabilities exist — expected
  if (
    result.status !== 0 &&
    result.status !== 1 &&
    Object.keys(auditJson.vulnerabilities ?? {}).length === 0
  ) {
    throw new Error(
      `npm audit failed in ${workspaceDir}: ${result.stderr || result.stdout || result.status}`,
    );
  }

  return auditJson;
}

/** Fail fast when dismissals.json entries use missing or unknown reasons. */
export function validateDismissals(dismissalsFile) {
  for (const dismissal of dismissalsFile.dismissals ?? []) {
    if (!dismissal.reason || !DISMISSAL_REASONS.has(dismissal.reason)) {
      const label = dismissal.id ?? dismissal.package ?? "unknown";
      throw new Error(
        `Invalid dismissal reason for ${label}: must be one of ${[...DISMISSAL_REASONS].join(", ")}`,
      );
    }
  }
}

/** Scan configured workspaces and triage npm audit alerts. */
export function collectAlerts(config, dismissals, { runAudit = runNpmAudit } = {}) {
  const allAlerts = [];

  for (const workspace of config.workspaces ?? []) {
    const lockPath = join(root, workspace.directory, workspace.lockfile ?? "package-lock.json");
    if (!existsSync(lockPath)) {
      continue;
    }

    if (workspace.production !== false) {
      const prodAudit = runAudit(workspace.directory, { omitDev: true });
      allAlerts.push(
        ...parseNpmAuditReport(prodAudit, {
          workspace: workspace.name,
          scope: "production",
        }),
      );
    }

    if (config.scanDevelopment) {
      const devAudit = runAudit(workspace.directory, { omitDev: false });
      const devAlerts = parseNpmAuditReport(devAudit, {
        workspace: workspace.name,
        scope: "development",
      });
      // Avoid duplicate rows when prod scan already captured the same package advisory
      const prodKeys = new Set(
        allAlerts
          .filter((a) => a.workspace === workspace.name && a.scope === "production")
          .map((a) => `${a.package}:${a.id}`),
      );
      for (const alert of devAlerts) {
        const key = `${alert.package}:${alert.id}`;
        if (!prodKeys.has(key)) {
          allAlerts.push(alert);
        }
      }
    }
  }

  return triageAlerts(allAlerts, dismissals, config);
}

/** Return open alerts that exceed configured per-scope severity gates. */
export function evaluateFailures(openAlerts, config) {
  const failOn = config.failOnSeverity ?? { production: "high" };
  const failures = [];

  for (const alert of openAlerts) {
    const threshold = failOn[alert.scope];
    if (threshold == null || threshold === "never" || threshold === "off") {
      continue;
    }
    if (severityMeetsThreshold(alert.severity, threshold)) {
      failures.push({ alert, threshold });
    }
  }

  return failures;
}

/** Render the GitHub step summary / console markdown report. */
export function renderMarkdownSummary(report) {
  const lines = [];
  lines.push(`# ${report.title}`);
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("|--------|------:|");
  lines.push(`| Open alerts | ${report.open.length} |`);
  lines.push(`| Dismissed (audited) | ${report.dismissed.length} |`);
  lines.push(`| Production scope | ${report.open.filter((a) => a.scope === "production").length} |`);
  lines.push(`| Development scope | ${report.open.filter((a) => a.scope === "development").length} |`);
  lines.push(`| With fix available | ${report.open.filter((a) => a.fixAvailable).length} |`);
  lines.push("");

  if (report.open.length === 0) {
    lines.push("No open dependency vulnerability alerts.");
    return lines.join("\n");
  }

  lines.push("## Prioritized open alerts");
  lines.push("");
  lines.push("| Priority | Severity | Scope | Workspace | Package | Fix |");
  lines.push("|---------:|----------|-------|-----------|---------|-----|");
  for (const alert of report.open.slice(0, 50)) {
    const fix = alert.fixAvailable ? (alert.fixVersion ? `yes → ${alert.fixVersion}` : "yes") : "no";
    lines.push(
      `| ${alert.priority} | ${alert.severity} | ${alert.scope} | ${alert.workspace} | ${alert.package} | ${fix} |`,
    );
  }
  if (report.open.length > 50) {
    lines.push("");
    lines.push(`_…and ${report.open.length - 50} more (see JSON artifact)._`);
  }

  lines.push("");
  lines.push("## Remediation");
  lines.push("");
  lines.push("1. Prefer alerts with **fix available** and **production** scope (GitHub: `has:patch`, `scope:runtime`).");
  lines.push("2. Run `npm run security:deps:fix` locally or dispatch **Dependency Security Bot → remediate**.");
  lines.push("3. To dismiss after review, add an entry to `.github/dependency-security-dismissals.json` with a reason.");
  lines.push("");
  return lines.join("\n");
}

/** Build the full scan report (open, dismissed, failures, passed). */
export function buildReport(config, dismissals, deps = {}) {
  const { open, dismissed } = collectAlerts(config, dismissals.dismissals ?? [], deps);
  const failures = evaluateFailures(open, config);

  return {
    title: config.reportTitle ?? "Dependency Security Bot",
    generatedAt: new Date().toISOString(),
    configVersion: config.version ?? 1,
    open,
    dismissed,
    failures,
    passed: failures.length === 0,
  };
}

function parseArgs(argv) {
  return {
    json: argv.includes("--json"),
    writeSummary: argv.includes("--write-summary"),
    writeArtifact: argv.includes("--write-artifact"),
    fail: !argv.includes("--no-fail"),
    configPath:
      argv.find((a, i) => argv[i - 1] === "--config") ??
      join(root, ".github/dependency-security.config.json"),
    dismissalsPath:
      argv.find((a, i) => argv[i - 1] === "--dismissals") ??
      join(root, ".github/dependency-security-dismissals.json"),
    artifactPath:
      argv.find((a, i) => argv[i - 1] === "--artifact") ??
      join(root, ".github/dependency-security-report.json"),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadJson(args.configPath, "dependency security config");
  const dismissals = loadJson(args.dismissalsPath, "dependency security dismissals");
  validateDismissals(dismissals);

  const report = buildReport(config, dismissals);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderMarkdownSummary(report));
  }

  if (args.writeArtifact) {
    mkdirSync(dirname(args.artifactPath), { recursive: true });
    writeFileSync(args.artifactPath, JSON.stringify(report, null, 2));
    console.log(`Wrote ${args.artifactPath}`);
  }

  if (args.writeSummary && process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, renderMarkdownSummary(report));
  }

  if (args.fail && !report.passed) {
    for (const { alert, threshold } of report.failures) {
      console.error(
        `::error::${alert.workspace} ${alert.scope} ${alert.severity} ${alert.package} (fail >= ${threshold})`,
      );
    }
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
