export type ReleaseBumpType = "patch" | "minor" | "major" | "custom";

export function normalizeTag(tag: string): string {
  const trimmed = tag.trim();
  return trimmed.match(/^v/i) ? trimmed : `v${trimmed}`;
}

export function bumpVersion(baseTag: string | null, type: ReleaseBumpType, custom?: string): string | null {
  if (type === "custom") {
    return custom?.trim() ? normalizeTag(custom) : null;
  }
  if (!baseTag) return null;
  const version = baseTag.replace(/^v/i, "").split("-")[0];
  const parts = version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const [major, minor, patch] = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  switch (type) {
    case "patch":
      return `v${major}.${minor}.${patch + 1}`;
    case "minor":
      return `v${major}.${minor + 1}.0`;
    case "major":
      return `v${major + 1}.0.0`;
    default:
      return null;
  }
}

/** Prefer the higher of live git tag vs package.json for release previews. */
export function effectiveVersionBase(liveTag: string | null, packageVersion: string | null): string | null {
  const candidates: string[] = [];
  if (liveTag) candidates.push(normalizeTag(liveTag));
  if (packageVersion) candidates.push(normalizeTag(packageVersion));
  if (!candidates.length) return null;
  return candidates.sort(compareTags).at(-1) ?? null;
}

/**
 * Compares the numeric version components of two tags.
 *
 * @param a - The first version tag
 * @param b - The second version tag
 * @returns A negative number if `a` precedes `b`, a positive number if `a` follows `b`, or `0` if their major, minor, and patch components are equal
 */
function compareTags(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split("-")[0].split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split("-")[0].split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

import { isValidMarketplaceTag, isBetaMarketplaceTag } from "./marketplace-deploy-policy";

/**
 * Determines whether a tag identifies a beta, alpha, or release candidate pre-release.
 *
 * @param tag - The tag to classify
 * @returns `true` if the tag contains `beta`, `alpha`, or `rc`, `false` otherwise.
 */
export function isBetaPrereleaseTag(tag: string): boolean {
  return /beta|alpha|rc/i.test(tag);
}

/**
 * Determines whether a tag identifies a rollback release.
 *
 * @param tag - The tag to classify
 * @returns `true` if the tag matches a major and minor version followed by an `R` release number, `false` otherwise.
 */
export function isRollbackReleaseTag(tag: string): boolean {
  return /^v?\d+\.\d+\.R\d+$/i.test(String(tag));
}

/**
 * Adds a status label to a release tag when applicable.
 *
 * @param tag - The release tag to label
 * @param liveTag - The tag currently live, if available
 * @returns The tag with its applicable status label
 */
export function formatTagLabel(tag: string, liveTag: string | null): string {
  if (liveTag && tag === liveTag) return `${tag} (Live)`;
  if (isRollbackReleaseTag(tag)) return `${tag} (Rollback release)`;
  if (isBetaPrereleaseTag(tag)) return `${tag} (Pre-release)`;
  return tag;
}

/**
 * Filters release tags for deployment, rollback, or infrastructure workflows.
 *
 * @param tags - Candidate release tags
 * @param channel - Release channel used to exclude prerelease-named tags
 * @param mode - Workflow mode; rollback mode includes all valid marketplace tags
 * @returns Marketplace-valid tags eligible for the specified channel and mode
 */
export function filterTagsForChannel(
  tags: string[],
  channel: "beta" | "production",
  mode: "deploy" | "rollback" | "infra"
): string[] {
  const marketplaceTags = tags.filter((tag) => isValidMarketplaceTag(tag));
  if (mode === "rollback") return marketplaceTags;
  if (channel === "production") {
    return marketplaceTags.filter((tag) => !isBetaPrereleaseTag(tag));
  }
  // Beta channel: semver tags (pre-release at publish) and vX.Y.Z-beta.N full-release tags.
  return marketplaceTags.filter(
    (tag) => isBetaMarketplaceTag(tag) || (!isBetaPrereleaseTag(tag) && !/-dev\.|-pr\./i.test(tag)),
  );
}

/**
 * Selects the preferred release tag from the available tags.
 *
 * @param tags - The available release tags
 * @param liveTag - The currently live tag, when available
 * @param suggestedTag - The suggested tag, when available
 * @returns The suggested tag, live tag, first available tag, or an empty string
 */
export function defaultTagSelection(
  tags: string[],
  liveTag: string | null,
  suggestedTag: string | null
): string {
  if (suggestedTag && tags.includes(suggestedTag)) return suggestedTag;
  if (liveTag && tags.includes(liveTag)) return liveTag;
  return tags[0] ?? "";
}

/**
 * Next deploy tag: prepared/suggested tag (+1 patch) when available, never the live tag alone.
 */
export function defaultDeployTag(
  tags: string[],
  liveTag: string | null,
  preparedTag: string | null
): string {
  if (preparedTag && tags.includes(preparedTag)) return preparedTag;
  return defaultTagSelection(tags, liveTag, preparedTag);
}

/**
 * Default rollback source: newest semver tag that is not the live tag or an R-release.
 */
export function defaultRollbackSourceTag(tags: string[], liveTag: string | null): string {
  const semverSources = tags.filter((tag) => !isRollbackReleaseTag(tag) && tag !== liveTag);
  if (semverSources.length > 0) return semverSources[0];
  const nonLive = tags.filter((tag) => tag !== liveTag);
  return nonLive[0] ?? tags[0] ?? "";
}
