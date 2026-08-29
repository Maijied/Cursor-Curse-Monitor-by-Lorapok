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

function compareTags(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split("-")[0].split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split("-")[0].split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

import { isValidMarketplaceTag } from "./marketplace-deploy-policy";

export function isBetaPrereleaseTag(tag: string): boolean {
  return /beta|alpha|rc/i.test(tag);
}

export function isRollbackReleaseTag(tag: string): boolean {
  return /^v?\d+\.\d+\.R\d+$/i.test(String(tag));
}

export function formatTagLabel(tag: string, liveTag: string | null): string {
  if (liveTag && tag === liveTag) return `${tag} (Live)`;
  if (isRollbackReleaseTag(tag)) return `${tag} (Rollback release)`;
  if (isBetaPrereleaseTag(tag)) return `${tag} (Pre-release)`;
  return tag;
}

/** Tags shown in the Deploy / Rollback pickers for the selected channel. */
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
  // Beta channel: semver tags only; pre-release is set at publish time (--pre-release), not in the tag name.
  return marketplaceTags.filter((tag) => !isBetaPrereleaseTag(tag));
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
