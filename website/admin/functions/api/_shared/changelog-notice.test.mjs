import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChangelogShortMessage,
  buildNoticeDraftFromChangelog,
  changelogNoticeId,
  extractChangelogHeading,
  inferChangelogSeverity,
} from "./changelog-notice.js";

const SAMPLE = `# Changelog

## Unreleased
### Added
- Mission Control feature ACL

## [1.0.3] - 2026-08-25
### Added
- Animated live stats hero

### Security
- Hardened token storage

## [1.0.1] - 2026-08-25
### Added
- v1.0.1 production release
`;

test("changelogNoticeId normalizes tags", () => {
  assert.equal(changelogNoticeId("v1.0.3"), "changelog-1.0.3");
  assert.equal(changelogNoticeId("1.0.3"), "changelog-1.0.3");
});

test("extractChangelogHeading reads Unreleased and version sections", () => {
  assert.match(extractChangelogHeading(SAMPLE, "Unreleased") ?? "", /Mission Control feature ACL/);
  assert.match(extractChangelogHeading(SAMPLE, "v1.0.3") ?? "", /Animated live stats hero/);
  assert.equal(extractChangelogHeading(SAMPLE, "v9.9.9"), null);
});

test("inferChangelogSeverity flags security sections", () => {
  assert.equal(inferChangelogSeverity("### Added\n- x"), "info");
  assert.equal(inferChangelogSeverity("### Security\n- patch"), "critical");
});

test("buildChangelogShortMessage prefers Added bullets", () => {
  const section = extractChangelogHeading(SAMPLE, "v1.0.3");
  assert.equal(buildChangelogShortMessage(section), "Animated live stats hero");
});

test("buildNoticeDraftFromChangelog returns disabled draft", () => {
  const draft = buildNoticeDraftFromChangelog(SAMPLE, "v1.0.3");
  assert.equal(draft.id, "changelog-1.0.3");
  assert.equal(draft.enabled, false);
  assert.equal(draft.source, "changelog");
  assert.equal(draft.severity, "critical");
  assert.match(draft.message, /Animated live stats hero/);
  assert.match(draft.message, /github\.com/);
});
