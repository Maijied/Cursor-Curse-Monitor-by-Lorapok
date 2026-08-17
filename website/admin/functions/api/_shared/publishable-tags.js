const BLOCKED_TAGS = new Set(["v0.5.10"]);
const MIN_PUBLISH_TAG = [0, 5, 5];

function tagParts(tag) {
  return String(tag)
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isPublishableTag(tag) {
  if (BLOCKED_TAGS.has(tag)) return false;
  const [major, minor, patch] = tagParts(tag);
  const [minMajor, minMinor, minPatch] = MIN_PUBLISH_TAG;
  if (major !== minMajor) return major > minMajor;
  if (minor !== minMinor) return minor > minMinor;
  return patch >= minPatch;
}

export function filterPublishableTags(tags) {
  return tags.filter((tag) => isPublishableTag(tag));
}
