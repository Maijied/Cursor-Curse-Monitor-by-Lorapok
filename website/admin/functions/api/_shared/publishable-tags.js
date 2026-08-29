import { isValidMarketplaceTag } from "./marketplace-tag-policy.js";

/**
 * Parses a version tag into numeric major, minor, and patch components.
 * @param {*} tag - The tag to parse, including optional `v` prefixes and rollback formats.
 * @return {number[]} The numeric major, minor, and patch components.
 */
function tagParts(tag) {
  const rollback = String(tag).match(/^v?(\d+)\.(\d+)\.R(\d+)$/i);
  if (rollback) {
    return [
      Number.parseInt(rollback[1], 10) || 0,
      Number.parseInt(rollback[2], 10) || 0,
      Number.parseInt(rollback[3], 10) || 0,
    ];
  }
  return String(tag)
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

/**
 * Compares two version tags by their major, minor, and patch components.
 * @param {string} a - The first version tag.
 * @param {string} b - The second version tag.
 * @return {number} A negative number if `a` precedes `b`, a positive number if `a` follows `b`, or `0` if they are equivalent.
 */
export function compareTags(a, b) {
  const [aMaj, aMin, aPatch] = tagParts(a);
  const [bMaj, bMin, bPatch] = tagParts(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPatch - bPatch;
}

/**
 * Filters tags to include only those accepted by the marketplace tag policy.
 * @param {string[]} tags - The tags to evaluate.
 * @return {string[]} The publishable tags.
 */
export function filterPublishableTags(tags) {
  return tags.filter((tag) => isValidMarketplaceTag(tag));
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
