import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computePriority,
  evaluateFailures,
  extractAdvisoryIds,
  isDismissed,
  parseNpmAuditReport,
  severityMeetsThreshold,
  triageAlerts,
} from "./dependency-security-bot.mjs";

const sampleAudit = {
  vulnerabilities: {
    lodash: {
      name: "lodash",
      severity: "high",
      isDirect: true,
      via: [
        {
          source: 12345,
          name: "lodash",
          dependency: "lodash",
          title: "Prototype Pollution",
          url: "https://github.com/advisories/GHSA-XXXX-YYYY-ZZZZ",
          severity: "high",
          range: "<4.17.21",
        },
      ],
      effects: [],
      range: "4.17.20",
      nodes: ["node_modules/lodash"],
      fixAvailable: { name: "lodash", version: "4.17.21" },
    },
    chalk: {
      name: "chalk",
      severity: "moderate",
      isDirect: false,
      via: ["ansi-styles"],
      effects: [],
      range: "5.0.0 - 5.3.0",
      nodes: ["node_modules/chalk"],
      fixAvailable: false,
    },
  },
};

describe("dependency-security-bot", () => {
  it("extracts GHSA advisory ids from npm audit via entries", () => {
    const ids = extractAdvisoryIds(sampleAudit.vulnerabilities.lodash.via);
    assert.deepEqual(ids, ["GHSA-XXXX-YYYY-ZZZZ", "12345"]);
  });

  it("parses npm audit into normalized alerts", () => {
    const alerts = parseNpmAuditReport(sampleAudit, {
      workspace: "root",
      scope: "production",
    });
    assert.equal(alerts.length, 2);
    assert.equal(alerts[0].package, "lodash");
    assert.equal(alerts[0].fixAvailable, true);
    assert.equal(alerts[0].fixVersion, "4.17.21");
  });

  it("prioritizes production + fixable alerts higher", () => {
    const prod = computePriority("high", "production", true);
    const dev = computePriority("high", "development", false);
    assert.ok(prod > dev);
  });

  it("respects audited dismissals", () => {
    const alerts = parseNpmAuditReport(sampleAudit, {
      workspace: "root",
      scope: "production",
    });
    const dismissals = [
      {
        id: "GHSA-XXXX-YYYY-ZZZZ",
        reason: "tolerate_risk",
        comment: "Transitive only in dev tooling",
      },
    ];
    const { open, dismissed } = triageAlerts(alerts, dismissals, {});
    assert.equal(open.length, 1);
    assert.equal(open[0].package, "chalk");
    assert.equal(dismissed.length, 1);
    assert.equal(dismissed[0].package, "lodash");
  });

  it("matches dismissals by package and workspace", () => {
    const alert = {
      id: "x",
      advisoryIds: [],
      package: "chalk",
      workspace: "admin",
      severity: "moderate",
    };
    const hit = isDismissed(alert, [{ package: "chalk", workspace: "admin", reason: "inaccurate" }]);
    assert.ok(hit);
  });

  it("fails when production alerts meet configured threshold", () => {
    const open = [
      { scope: "production", severity: "high", package: "lodash" },
      { scope: "development", severity: "critical", package: "chalk" },
    ];
    const failures = evaluateFailures(open, {
      failOnSeverity: { production: "high" },
    });
    assert.equal(failures.length, 1);
    assert.equal(failures[0].alert.package, "lodash");
  });

  it("does not fail development alerts unless threshold is configured", () => {
    const open = [{ scope: "development", severity: "critical", package: "web-ext" }];
    const failures = evaluateFailures(open, { failOnSeverity: { production: "high" } });
    assert.equal(failures.length, 0);
  });

  it("compares severities against thresholds", () => {
    assert.ok(severityMeetsThreshold("critical", "high"));
    assert.ok(!severityMeetsThreshold("moderate", "high"));
  });
});
