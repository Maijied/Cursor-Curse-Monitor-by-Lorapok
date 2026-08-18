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

export function formatTagLabel(tag: string, liveTag: string | null): string {
  if (liveTag && tag === liveTag) return `${tag} (Live)`;
  return tag;
}

export function defaultTagSelection(
  tags: string[],
  liveTag: string | null,
  suggestedTag: string | null
): string {
  if (suggestedTag && tags.includes(suggestedTag)) return suggestedTag;
  if (liveTag && tags.includes(liveTag)) return liveTag;
  return tags[0] ?? "";
}
