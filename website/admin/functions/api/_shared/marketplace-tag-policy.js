/** @typedef {"Both" | "Open VSX + Firefox AMO" | "Open VSX" | "VS Code Marketplace" | "Firefox AMO"} PublishMarket */
/** @typedef {"Production" | "Beta (Pre-release)"} ReleaseChannel */

const MIN_PUBLISH_TAG = [0, 5, 5];

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

/** CI artifact tags that must not ship to marketplaces. */
export function hasCiOnlySuffix(tag) {
  if (isRollbackTag(tag)) return false;
  return /-(dev|pr|beta|alpha|rc)/i.test(String(tag).replace(/^v/i, ""));
}

/**
 * @param {string} tag
 * @returns {boolean}
 */
export function isValidMarketplaceTag(tag) {
  if (isRollbackTag(tag)) return meetsMinVersion(tag);
  if (!isMarketplaceSemverTag(tag)) return false;
  if (hasCiOnlySuffix(tag)) return false;
  return meetsMinVersion(tag);
}

/**
 * @param {PublishMarket} publishMarket
 * @returns {boolean}
 */
export function marketIncludesAmo(publishMarket) {
  return (
    publishMarket === "Firefox AMO" ||
    publishMarket === "Open VSX + Firefox AMO" ||
    publishMarket === "Both"
  );
}

/**
 * @param {ReleaseChannel} releaseChannel
 * @returns {boolean}
 */
export function isBetaChannel(releaseChannel) {
  return releaseChannel === "Beta (Pre-release)";
}

/**
 * @param {{
 *   targetTag: string;
 *   releaseChannel: ReleaseChannel;
 *   publishMarket: PublishMarket;
 * }} params
 * @returns {{ ok: true } | { ok: false; error: string }}
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
