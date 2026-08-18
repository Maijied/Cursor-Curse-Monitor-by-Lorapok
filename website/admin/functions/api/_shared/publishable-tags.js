const MIN_PUBLISH_TAG = [0, 5, 5];

function tagParts(tag) {
  return String(tag)
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isPublishableTag(tag) {
  const [major, minor, patch] = tagParts(tag);
  const [minMajor, minMinor, minPatch] = MIN_PUBLISH_TAG;
  if (major !== minMajor) return major > minMajor;
  if (minor !== minMinor) return minor > minMinor;
  return patch >= minPatch;
}

/** @returns {number} negative if a < b, positive if a > b, 0 if equal */
export function compareTags(a, b) {
  const [aMaj, aMin, aPatch] = tagParts(a);
  const [bMaj, bMin, bPatch] = tagParts(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPatch - bPatch;
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
