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

export function loadJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

export function severityMeetsThreshold(severity, threshold) {
  return (SEVERITY_RANK[severity] ?? 0) >= (SEVERITY_RANK[threshold] ?? 0);
}

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

export function parseNpmAuditReport(auditJson, { workspace, scope }) {
  const vulnerabilities = auditJson?.vulnerabilities ?? {};
  const alerts = [];

  for (const [pkgName, detail] of Object.entries(vulnerabilities)) {
    const severity = String(detail.severity ?? "moderate").toLowerCase();
    const advisoryIds = extractAdvisoryIds(detail.via);
    const fixAvailable = Boolean(
      detail.fixAvailable === true ||
        (detail.fixAvailable && typeof detail.fixAvailable === "object"),
    );
    const fixVersion =
      detail.fixAvailable && typeof detail.fixAvailable === "object"
        ? detail.fixAvailable.version
        : null;

    alerts.push({
      id: advisoryIds[0] ?? `${workspace}:${pkgName}:${detail.range ?? "unknown"}`,
      advisoryIds,
      workspace,
      scope,
      ecosystem: "npm",
      package: pkgName,
      severity,
      isDirect: Boolean(detail.isDirect),
      range: detail.range ?? "",
      fixAvailable,
      fixVersion,
      title: detail.name ?? pkgName,
      url:
        detail.via?.find?.((v) => typeof v === "object" && v.url)?.url ??
        "https://docs.npmjs.com/cli/v10/commands/npm-audit",
      priority: computePriority(severity, scope, fixAvailable),
    });
  }

  return alerts;
}

export function computePriority(severity, scope, fixAvailable, config = {}) {
  const base = (SEVERITY_RANK[severity] ?? 0) * 10;
  const productionBoost = scope === "production" && config.prioritizeProduction !== false ? 5 : 0;
  const fixBoost = fixAvailable && config.boostWhenFixAvailable !== false ? 3 : 0;
  return base + productionBoost + fixBoost;
}

export function isDismissed(alert, dismissals) {
  for (const dismissal of dismissals) {
    if (dismissal.id && dismissal.id === alert.id) return dismissal;
    if (dismissal.package && dismissal.package === alert.package) {
      if (!dismissal.workspace || dismissal.workspace === alert.workspace) {
        if (!dismissal.severity || dismissal.severity === alert.severity) {
          return dismissal;
        }
      }
    }
    for (const advisoryId of alert.advisoryIds) {
      if (dismissal.id === advisoryId) return dismissal;
    }
  }
  return null;
}

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
  }

  // npm audit exits 1 when vulnerabilities exist — expected
  if (result.status !== 0 && result.status !== 1 && !stdout) {
    throw new Error(
      `npm audit failed in ${workspaceDir}: ${result.stderr || result.stdout || result.status}`,
    );
  }

  return auditJson;
}

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

  for (const dismissal of dismissals.dismissals ?? []) {
    if (dismissal.reason && !DISMISSAL_REASONS.has(dismissal.reason)) {
      console.warn(
        `::warning::Unknown dismissal reason "${dismissal.reason}" for ${dismissal.id ?? dismissal.package}`,
      );
    }
  }

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
