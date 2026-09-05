import { GITHUB_REPO } from "./repo-constants.js";
import { extractChangelogSection, normalizeTag } from "./discord-deploy-context.js";

const DEFAULT_FEEDBACK_URL = `https://github.com/${GITHUB_REPO}/issues`;
const DEFAULT_COLLABORATE_URL = `https://github.com/${GITHUB_REPO}/discussions`;

/**
 * Stable catalog id for a release-tag changelog draft.
 * @param {string} tag
 */
export function changelogNoticeId(tag) {
  const releaseTag = normalizeTag(tag);
  const version = releaseTag.replace(/^v/i, "");
  return `changelog-${version}`;
}

/**
 * @param {string} markdown
 * @param {string} heading - e.g. "Unreleased" or "1.0.3"
 */
export function extractChangelogHeading(markdown, heading) {
  const value = String(heading ?? "").trim();
  if (!value) return null;

  if (/^unreleased$/i.test(value)) {
    const match = markdown.match(/^##\s+Unreleased\b/im);
    if (!match || match.index == null) return null;
    const start = match.index + match[0].length;
    const rest = markdown.slice(start);
    const next = rest.search(/^## \[/m);
    const section = (next === -1 ? rest : rest.slice(0, next)).trim();
    return section || null;
  }

  return extractChangelogSection(markdown, value);
}

/**
 * @param {string} section
 */
export function inferChangelogSeverity(section) {
  if (/###\s+Security\b/i.test(section)) return "critical";
  if (/###\s+Fixed\b/i.test(section) && !/###\s+Added\b/i.test(section)) return "info";
  return "info";
}

/**
 * @param {string} section
 * @param {number} [maxLen]
 */
export function buildChangelogShortMessage(section, maxLen = 140) {
  const added = section.match(/###\s+Added[^\n]*\n([\s\S]*?)(?=\n###|\n##|$)/i);
  if (added) {
    const bullet = added[1].match(/^-\s+(.+)/m);
    if (bullet?.[1]) return bullet[1].trim().slice(0, maxLen);
  }
  const bullet = section.match(/^-\s+(.+)/m);
  if (bullet?.[1]) return bullet[1].trim().slice(0, maxLen);
  const line = section
    .split("\n")
    .map((row) => row.trim())
    .find((row) => row && !row.startsWith("#"));
  return (line ?? "New release").slice(0, maxLen);
}

/**
 * @param {string} section
 * @param {string} tag
 * @param {{ releaseUrl?: string; homepage?: string; productName?: string }} [options]
 */
export function formatChangelogNoticeMessage(section, tag, options = {}) {
  const isUnreleased = /^unreleased$/i.test(String(tag).trim());
  const releaseTag = isUnreleased ? "Unreleased" : normalizeTag(tag);
  const releaseUrl = isUnreleased
    ? `https://github.com/${GITHUB_REPO}/blob/main/CHANGELOG.md`
    : options.releaseUrl ?? `https://github.com/${GITHUB_REPO}/releases/tag/${encodeURIComponent(releaseTag)}`;
  const homepage = options.homepage ?? "https://cursor.lorapok.tech";
  const productName = options.productName ?? "Cursor Curse Monitor";
  const headline = isUnreleased ? `${productName} (Unreleased preview)` : `${productName} ${releaseTag}`;
  return `${headline} is available.\n\n${section.trim()}\n\nRelease notes: ${releaseUrl}\nProduct site: ${homepage}`;
}

/**
 * @param {string} markdown
 * @param {string} tag
 * @param {{ productName?: string; releaseUrl?: string; homepage?: string; feedbackUrl?: string; collaborateUrl?: string }} [options]
 */
export function buildNoticeDraftFromChangelog(markdown, tag, options = {}) {
  const section = extractChangelogHeading(markdown, tag);
  if (!section) {
    throw new Error(`No CHANGELOG section found for ${tag}`);
  }

  const releaseTag = /^unreleased$/i.test(String(tag).trim()) ? "Unreleased" : normalizeTag(tag);
  const titleTag = /^unreleased$/i.test(String(tag).trim()) ? "preview" : releaseTag;

  return {
    id: changelogNoticeId(/^unreleased$/i.test(String(tag).trim()) ? "unreleased" : tag),
    enabled: false,
    type: "development",
    source: "changelog",
    severity: inferChangelogSeverity(section),
    title: `${options.productName ?? "Cursor Curse Monitor"} ${titleTag}`,
    shortMessage: buildChangelogShortMessage(section),
    message: formatChangelogNoticeMessage(section, /^unreleased$/i.test(String(tag).trim()) ? "unreleased" : tag, options),
    feedbackUrl: options.feedbackUrl ?? DEFAULT_FEEDBACK_URL,
    collaborateUrl: options.collaborateUrl ?? DEFAULT_COLLABORATE_URL,
    updatedAt: new Date().toISOString(),
    dismissible: true,
    changelogTag: releaseTag,
  };
}

/**
 * @param {Record<string, unknown>} env
 */
export async function fetchChangelogMarkdown(env) {
  const res = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/main/CHANGELOG.md`, {
    headers: { Accept: "text/plain" },
  });
  if (!res.ok) {
    throw new Error(`CHANGELOG fetch failed (${res.status})`);
  }
  return res.text();
}
