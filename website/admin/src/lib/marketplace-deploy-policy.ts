export type PublishMarket =
  | "Both"
  | "Open VSX + Firefox AMO"
  | "Open VSX"
  | "VS Code Marketplace"
  | "Firefox AMO";

export type ReleaseChannel = "Production" | "Beta (Pre-release)";

/**
 * Determines whether a tag identifies a rollback release.
 *
 * @param tag - The tag to evaluate
 * @returns `true` if the tag matches the major.minor.Rnumber format, `false` otherwise.
 */
export function isRollbackTag(tag: string): boolean {
  return /^v?\d+\.\d+\.R\d+$/i.test(String(tag));
}

/**
 * Determines whether a tag uses a three-part semantic version format.
 *
 * @param tag - The tag to evaluate
 * @returns `true` if the tag contains an optional `v` prefix followed by major, minor, and patch numbers, `false` otherwise.
 */
export function isMarketplaceSemverTag(tag: string): boolean {
  return /^v?\d+\.\d+\.\d+$/i.test(String(tag));
}

/**
 * Determines whether a tag has a CI-only release suffix.
 *
 * @param tag - The version tag to inspect
 * @returns `true` if the tag contains a `-dev`, `-pr`, `-beta`, `-alpha`, or `-rc` suffix and is not a rollback tag, `false` otherwise.
 */
export function hasCiOnlySuffix(tag: string): boolean {
  if (isRollbackTag(tag)) return false;
  return /-(dev|pr|beta|alpha|rc)/i.test(String(tag).replace(/^v/i, ""));
}

const MIN_PUBLISH_TAG = [0, 5, 5] as const;

/**
 * Parses a rollback or semantic-version tag into its major, minor, and patch components.
 *
 * @param tag - The version tag to parse
 * @returns A tuple containing the numeric major, minor, and patch components, with invalid or missing components represented as `0`
 */
function tagParts(tag: string): [number, number, number] {
  const rollback = String(tag).match(/^v?(\d+)\.(\d+)\.R(\d+)$/i);
  if (rollback) {
    return [
      Number.parseInt(rollback[1], 10) || 0,
      Number.parseInt(rollback[2], 10) || 0,
      Number.parseInt(rollback[3], 10) || 0,
    ];
  }
  const parts = String(tag)
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Determines whether a version tag meets the minimum supported publishing version.
 *
 * @param tag - The version tag to evaluate
 * @returns `true` if the tag's version is at least `v0.5.5`, `false` otherwise.
 */
function meetsMinVersion(tag: string): boolean {
  const [major, minor, patch] = tagParts(tag);
  const [minMajor, minMinor, minPatch] = MIN_PUBLISH_TAG;
  if (major !== minMajor) return major > minMajor;
  if (minor !== minMinor) return minor > minMinor;
  return patch >= minPatch;
}

/**
 * Determines whether a marketplace tag is a supported version at or above `v0.5.5`.
 *
 * @param tag - The version tag to validate
 * @returns `true` if the tag is a valid marketplace version, `false` otherwise
 */
export function isValidMarketplaceTag(tag: string): boolean {
  if (isRollbackTag(tag)) return meetsMinVersion(tag);
  if (!isMarketplaceSemverTag(tag)) return false;
  if (hasCiOnlySuffix(tag)) return false;
  return meetsMinVersion(tag);
}

/**
 * Determines whether a publish market includes Firefox AMO.
 *
 * @param market - The marketplace target to inspect
 * @returns `true` if the market includes Firefox AMO, `false` otherwise
 */
export function marketIncludesAmo(market: PublishMarket): boolean {
  return market === "Firefox AMO" || market === "Open VSX + Firefox AMO" || market === "Both";
}

/**
 * Validates a marketplace deployment tag, release channel, and publish market.
 *
 * @param params - Deployment settings to validate
 * @param params.targetTag - Version tag to publish
 * @param params.releaseChannel - Channel used for the release
 * @param params.publishMarket - Marketplace targets for the deployment
 * @returns `{ ok: true }` for valid settings, or `{ ok: false, error }` with a validation message
 */
export function validateMarketplaceDeploy(params: {
  targetTag: string;
  releaseChannel: ReleaseChannel;
  publishMarket: PublishMarket;
}): { ok: true } | { ok: false; error: string } {
  const { targetTag, releaseChannel, publishMarket } = params;
  if (!isValidMarketplaceTag(targetTag)) {
    return {
      ok: false,
      error: `Tag ${targetTag} is not valid for marketplace publish. Use vMAJOR.MINOR.PATCH or rollback vMAJOR.MINOR.Rn (minimum v0.5.5). CI-only tags (-dev, -pr, -beta) cannot be published.`,
    };
  }
  if (releaseChannel === "Beta (Pre-release)" && marketIncludesAmo(publishMarket)) {
    return {
      ok: false,
      error:
        "Firefox AMO has no pre-release channel in this pipeline. Use Production channel or choose a market without Firefox AMO.",
    };
  }
  return { ok: true };
}
