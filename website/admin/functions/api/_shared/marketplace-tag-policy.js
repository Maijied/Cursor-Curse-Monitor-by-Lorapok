/** @typedef {"Both" | "Open VSX + Firefox AMO" | "Open VSX" | "VS Code Marketplace" | "Firefox AMO"} PublishMarket */
/** @typedef {"Production" | "Beta (Pre-release)"} ReleaseChannel */

const MIN_PUBLISH_TAG = [0, 5, 5];

/**
 * Parses a standard or rollback version tag into numeric components.
 * @param {*} tag - The version tag to parse.
 * @return {number[]} The major, minor, and patch or rollback components, using `0` for invalid components.
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
 * Determines whether a version tag meets the minimum publishable version.
 * @param {string} tag - The version tag to evaluate.
 * @return {boolean} `true` if the tag is at least version 0.5.5, `false` otherwise.
 */
function meetsMinVersion(tag) {
  const [major, minor, patch] = tagParts(tag);
  const [minMajor, minMinor, minPatch] = MIN_PUBLISH_TAG;
  if (major !== minMajor) return major > minMajor;
  if (minor !== minMinor) return minor > minMinor;
  return patch >= minPatch;
}

/** Rollback releases: v{major}.{minor}.R{n} */
export function isRollbackTag(tag) {
  return /^v?\d+\.\d+\.R\d+$/i.test(String(tag));
}

/** Marketplace semver tags: vMAJOR.MINOR.PATCH (no -beta / -dev suffix). */
export function isMarketplaceSemverTag(tag) {
  return /^v?\d+\.\d+\.\d+$/i.test(String(tag));
}

/**
 * Determines whether a tag has a CI-only suffix.
 * @param {*} tag - The tag to inspect.
 * @return {boolean} `true` if the tag has a `-dev`, `-pr`, `-beta`, `-alpha`, or `-rc` suffix and is not a rollback tag, `false` otherwise.
 */
export function hasCiOnlySuffix(tag) {
  if (isRollbackTag(tag)) return false;
  return /-(dev|pr|beta|alpha|rc)/i.test(String(tag).replace(/^v/i, ""));
}

/**
 * Determines whether a marketplace tag meets the accepted format and minimum version requirements.
 * @param {string} tag - The marketplace tag to validate.
 * @returns {boolean} `true` if the tag is a valid rollback or plain version tag at or above the minimum version, `false` otherwise.
 */
export function isValidMarketplaceTag(tag) {
  if (isRollbackTag(tag)) return meetsMinVersion(tag);
  if (!isMarketplaceSemverTag(tag)) return false;
  if (hasCiOnlySuffix(tag)) return false;
  return meetsMinVersion(tag);
}

/**
 * Determines whether the selected publish market includes Firefox AMO.
 * @param {PublishMarket} publishMarket - The marketplace publication target.
 * @returns {boolean} `true` if the market includes Firefox AMO, `false` otherwise.
 */
export function marketIncludesAmo(publishMarket) {
  return (
    publishMarket === "Firefox AMO" ||
    publishMarket === "Open VSX + Firefox AMO" ||
    publishMarket === "Both"
  );
}

/**
 * Determines whether a release channel is the beta pre-release channel.
 * @param {ReleaseChannel} releaseChannel - The release channel to evaluate.
 * @return {boolean} `true` if the channel is beta, `false` otherwise.
 */
export function isBetaChannel(releaseChannel) {
  return releaseChannel === "Beta (Pre-release)";
}

/**
 * Validates a marketplace deployment tag and release-market compatibility.
 * @param {Object} params - Deployment details.
 * @param {string} params.targetTag - Marketplace version or rollback tag.
 * @param {ReleaseChannel} params.releaseChannel - Release channel for the deployment.
 * @param {PublishMarket} params.publishMarket - Marketplace targeted by the deployment.
 * @returns {{ ok: true } | { ok: false, error: string }} A success result or a descriptive validation error.
 */
export function validateMarketplaceDeploy({ targetTag, releaseChannel, publishMarket }) {
  if (!isValidMarketplaceTag(targetTag)) {
    return {
      ok: false,
      error: `Tag ${targetTag} is not valid for marketplace publish. Use vMAJOR.MINOR.PATCH or rollback vMAJOR.MINOR.Rn (minimum v0.5.5). CI-only tags (-dev, -pr, -beta) cannot be published.`,
    };
  }

  if (isBetaChannel(releaseChannel) && marketIncludesAmo(publishMarket)) {
    return {
      ok: false,
      error:
        "Firefox AMO has no pre-release channel in this pipeline. Use Production channel or choose a market without Firefox AMO.",
    };
  }

  return { ok: true };
}
