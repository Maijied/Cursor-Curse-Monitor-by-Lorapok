const MIN_PUBLISH_TAG = [0, 5, 5];

/**
 * Parse a semver tag into [major, minor, patch, prerelease].
 * Returns null if the tag is malformed.
 * @param {string} tag
 * @returns {{ major: number; minor: number; patch: number; prerelease: string | null } | null}
 */
function tagParts(tag) {
  const normalized = String(tag).replace(/^v/i, "");
  const [version, ...prereleaseParts] = normalized.split("-");
  const parts = version.split(".");

  // Strict validation: require exactly 3 numeric parts
  if (parts.length !== 3) return null;

  const [major, minor, patch] = parts.map((p) => Number.parseInt(p, 10));

  // Reject if any part is NaN or negative
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) return null;
  if (major < 0 || minor < 0 || patch < 0) return null;

  const prerelease = prereleaseParts.length > 0 ? prereleaseParts.join("-") : null;

  return { major, minor, patch, prerelease };
}

function isPublishableTag(tag) {
  const parsed = tagParts(tag);
  if (!parsed) return false;

  const { major, minor, patch } = parsed;
  const [minMajor, minMinor, minPatch] = MIN_PUBLISH_TAG;
  if (major !== minMajor) return major > minMajor;
  if (minor !== minMinor) return minor > minMinor;
  return patch >= minPatch;
}

/** @returns {number} negative if a < b, positive if a > b, 0 if equal */
export function compareTags(a, b) {
  const aParsed = tagParts(a);
  const bParsed = tagParts(b);

  // Reject malformed tags by treating them as less than any valid tag
  if (!aParsed && !bParsed) return 0;
  if (!aParsed) return -1;
  if (!bParsed) return 1;

  // Compare major.minor.patch
  if (aParsed.major !== bParsed.major) return aParsed.major - bParsed.major;
  if (aParsed.minor !== bParsed.minor) return aParsed.minor - bParsed.minor;
  if (aParsed.patch !== bParsed.patch) return aParsed.patch - bParsed.patch;

  // Prerelease ordering: stable (null) > any prerelease
  if (aParsed.prerelease === null && bParsed.prerelease === null) return 0;
  if (aParsed.prerelease === null) return 1;  // stable a > prerelease b
  if (bParsed.prerelease === null) return -1; // prerelease a < stable b

  // Both are prereleases: lexicographic comparison
  return aParsed.prerelease.localeCompare(bParsed.prerelease);
}

export function filterPublishableTags(tags) {
  return tags.filter((tag) => isPublishableTag(tag));
}

/**
 * @param {string[]} tags
 * @param {string | null} liveTag
 */
export function enrichTags(tags, liveTag) {
  const sorted = [...tags].sort((a, b) => compareTags(b, a));
  const latestTag = sorted[0] ?? null;
  let suggestedTag = null;
  if (liveTag) {
    suggestedTag = sorted.find((tag) => compareTags(tag, liveTag) > 0) ?? null;
  }
  return {
    tags: sorted,
    liveTag: liveTag ?? null,
    latestTag,
    suggestedTag,
  };
}
