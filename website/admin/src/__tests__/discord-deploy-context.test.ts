import { describe, it, expect } from "vitest";
import {
  buildMarketplaceFields,
  buildQuickLinksText,
  extractChangelogSection,
  formatDownloadBreakdownText,
  normalizeTag,
  truncateDiscordText,
} from "../../functions/api/_shared/discord-deploy-context.js";

describe("discord deploy context formatters", () => {
  it("extracts a changelog section for a release tag", () => {
    const markdown = `# Changelog

## Unreleased
### Added
- pending work

## [1.0.3] - 2026-08-25
### Added
- Animated live stats hero

## [1.0.1] - 2026-08-25
### Added
- v1.0.1 production release`;

    expect(extractChangelogSection(markdown, "v1.0.3")).toContain("Animated live stats hero");
    expect(extractChangelogSection(markdown, "v1.0.3")).not.toContain("pending work");
  });

  it("formats verified download breakdown as a code block tree", () => {
    const text = formatDownloadBreakdownText({
      downloads: {
        verified: true,
        total: 9975,
        displayTotal: 9975,
        openVsxCombined: 9611,
        breakdown: {
          openVsxCanonical: 5798,
          openVsxDuplicate: 3813,
          vscodeMarketplace: 356,
          githubAllAssets: 8,
          latestReleaseVsix: 0,
        },
      },
    });

    expect(text).toContain("Total ········· 9,975");
    expect(text).toContain("Open VSX ········ 9,611");
    expect(text).toContain("VS Code ········· 356");
  });

  it("builds marketplace sync fields with emoji status", () => {
    const fields = buildMarketplaceFields(
      {
        packageVersion: "1.0.26",
        version: "1.0.26",
        syncStatus: "ahead",
        releaseStatus: "candidate",
        publishedReleaseVersion: "1.0.31",
        github: { releaseTag: "v1.0.31" },
        ovsx: { version: "1.0.29" },
        ovsxDuplicate: { version: "1.0.29" },
        vscode: { version: "1.0.29" },
        browserExtension: { firefox: { version: null } },
      },
      null
    );

    expect(fields.some((field) => field.name === "GitHub release" && field.value.includes("v1.0.31"))).toBe(true);
    expect(fields.some((field) => field.name === "Open VSX" && field.value.includes("⚠️"))).toBe(true);
  });

  it("normalizes tags and truncates long text", () => {
    expect(normalizeTag("1.0.3")).toBe("v1.0.3");
    expect(normalizeTag("v1.0.3")).toBe("v1.0.3");
    expect(truncateDiscordText("abcdef", 4)).toBe("abc…");
  });

  it("builds quick links with release and changelog URLs", () => {
    const links = buildQuickLinksText("v1.0.31");
    expect(links).toContain("cursor.lorapok.tech");
    expect(links).toContain("releases/tag/v1.0.31");
    expect(links).toContain("CHANGELOG.md");
  });
});
