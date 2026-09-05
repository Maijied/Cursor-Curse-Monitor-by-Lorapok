import {
  isBetaChannel,
  isBetaMarketplaceTag,
  isRollbackTag,
  isValidMarketplaceTag,
  validateMarketplaceDeploy,
} from "./marketplace-tag-policy.js";
import { compareSemver, normalizeSemver } from "./version-plan.js";

/** @typedef {"Production" | "Beta (Pre-release)"} ReleaseChannel */

/**
 * @param {string} tag
 * @returns {string}
 */
export function normalizeReleaseTag(tag) {
  const trimmed = String(tag ?? "").trim();
  if (!trimmed) return "";
  return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`;
}

/**
 * @param {string} tag
 * @returns {boolean}
 */
export function isCiDevPrTag(tag) {
  return /-(dev|pr)\./i.test(String(tag).replace(/^v/i, ""));
}

/**
 * Rollback restores source tree from an older semver tag — not R-releases or CI tags.
 * @param {string} tag
 * @returns {boolean}
 */
export function isRollbackSourceTag(tag) {
  if (!tag) return false;
  if (isRollbackTag(tag)) return false;
  if (isCiDevPrTag(tag)) return false;
  return isValidMarketplaceTag(tag);
}

/**
 * Classify a git tag for marketplace metadata, publish, and rollback eligibility.
 * @param {string} tag
 * @param {{ liveTag?: string | null, releaseChannel?: ReleaseChannel }} [options]
 */
export function classifyReleaseTag(tag, options = {}) {
  const normalized = normalizeReleaseTag(tag);
  const liveTag = options.liveTag ? normalizeReleaseTag(options.liveTag) : null;
  const releaseChannel = options.releaseChannel ?? "Production";
  const reasons = [];

  if (!normalized) {
    return {
      tag: normalized,
      metadataReady: false,
      publishReady: false,
      rollbackEligible: false,
      reasons: ["Tag is empty."],
    };
  }

  if (isCiDevPrTag(normalized)) {
    reasons.push("CI-only tags (-dev, -pr) cannot be published or used as rollback sources.");
  }

  if (isRollbackTag(normalized)) {
    reasons.push("Rollback output tags (vX.Y.Rn) are publish targets only — pick a semver source tag to roll back from.");
  }

  const policy = validateMarketplaceDeploy({
    targetTag: normalized,
    releaseChannel,
    publishMarket: "Both",
  });
  const metadataReady = policy.ok;
  if (!metadataReady) {
    reasons.push(policy.error);
  }

  if (releaseChannel === "Production" && isBetaMarketplaceTag(normalized)) {
    reasons.push("Production channel cannot publish vX.Y.Z-beta.N tags — switch to Beta (Pre-release).");
  }

  const isLive = Boolean(liveTag && normalized === liveTag);
  if (isLive) {
    reasons.push(`${normalized} is the current live tag — choose a prepared tag for deploy or an older tag for rollback.`);
  }

  const tagCore = normalizeSemver(normalized);
  const liveCore = liveTag ? normalizeSemver(liveTag) : null;
  const isOlderThanLive = Boolean(liveCore && tagCore && compareSemver(tagCore, liveCore) < 0);
  if (isRollbackSourceTag(normalized) && liveCore && tagCore && !isOlderThanLive && !isLive) {
    reasons.push(`${normalized} is not older than live ${liveTag} — rollback requires an earlier semver tag.`);
  }

  const publishReady =
    metadataReady &&
    !isLive &&
    !isRollbackTag(normalized) &&
    !isCiDevPrTag(normalized) &&
    !(releaseChannel === "Production" && isBetaMarketplaceTag(normalized));

  const rollbackEligible =
    isRollbackSourceTag(normalized) &&
    !isLive &&
    (!liveCore || isOlderThanLive) &&
    !(releaseChannel === "Production" && isBetaMarketplaceTag(normalized));

  return {
    tag: normalized,
    metadataReady,
    publishReady,
    rollbackEligible,
    isLive,
    releaseChannel,
    reasons,
  };
}

/**
 * @param {string[]} tags
 * @param {{ liveTag?: string | null, releaseChannel?: ReleaseChannel }} [options]
 * @returns {Record<string, ReturnType<typeof classifyReleaseTag>>}
 */
export function buildTagEligibilityMap(tags, options = {}) {
  const map = {};
  for (const tag of tags) {
    const normalized = normalizeReleaseTag(tag);
    if (!normalized) continue;
    map[normalized] = classifyReleaseTag(normalized, options);
  }
  return map;
}

/**
 * @param {object} params
 * @param {string} params.actionType
 * @param {string | null | undefined} params.targetTag
 * @param {ReleaseChannel} [params.releaseChannel]
 * @param {string | null | undefined} [params.liveTag]
 * @param {boolean} [params.tagExistsInGit]
 */
export function validateReleaseDispatch({
  actionType,
  targetTag,
  releaseChannel = "Production",
  liveTag = null,
  tagExistsInGit = true,
}) {
  const action = String(actionType ?? "");
  const normalizedTarget = targetTag ? normalizeReleaseTag(targetTag) : null;

  if (action.startsWith("deploy-infra") || action.startsWith("seo-refresh")) {
    return { ok: true, action: "infra", summary: "No tag validation required." };
  }

  if (action.startsWith("full-release")) {
    if (!isBetaChannel(releaseChannel) && releaseChannel !== "Production") {
      return { ok: false, error: `Invalid release_channel: ${releaseChannel}` };
    }
    return {
      ok: true,
      action: "full-release",
      summary: `Full-release allowed on ${releaseChannel} channel.`,
      releaseChannel,
    };
  }

  const needsTag =
    action.startsWith("publish-tag") ||
    action.startsWith("rollback") ||
    action.startsWith("sync-open-vsx");

  if (needsTag && !normalizedTarget) {
    return { ok: false, error: "target_tag is required for publish-tag, rollback, and sync-open-vsx." };
  }

  if (needsTag && tagExistsInGit === false) {
    return { ok: false, error: `Git tag ${normalizedTarget} was not found in the repository.` };
  }

  const classification = classifyReleaseTag(normalizedTarget, { liveTag, releaseChannel });

  if (action.startsWith("publish-tag")) {
    if (!classification.publishReady) {
      return {
        ok: false,
        error: `Tag ${normalizedTarget} is not ready to publish: ${classification.reasons.join(" ")}`,
        classification,
      };
    }
    return {
      ok: true,
      action: "publish-tag",
      classification,
      summary: `${normalizedTarget} is ready for marketplace publish (${releaseChannel}).`,
    };
  }

  if (action.startsWith("rollback")) {
    if (!classification.rollbackEligible) {
      return {
        ok: false,
        error: `Tag ${normalizedTarget} cannot be used as a rollback source: ${classification.reasons.join(" ")}`,
        classification,
      };
    }
    return {
      ok: true,
      action: "rollback",
      classification,
      summary: `${normalizedTarget} is eligible as a rollback source.`,
    };
  }

  if (action.startsWith("sync-open-vsx")) {
    if (!classification.metadataReady) {
      return {
        ok: false,
        error: `Tag ${normalizedTarget} is not ready for Open VSX metadata sync: ${classification.reasons.join(" ")}`,
        classification,
      };
    }
    return {
      ok: true,
      action: "sync-open-vsx",
      classification,
      summary: `${normalizedTarget} is ready for Open VSX metadata sync.`,
    };
  }

  return { ok: true, action: "unknown", summary: `No tag validation rule for action: ${action}` };
}
