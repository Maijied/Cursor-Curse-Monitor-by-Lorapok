import assert from "node:assert/strict";
import {
  buildTagEligibilityMap,
  classifyReleaseTag,
  validateReleaseDispatch,
} from "./release-tag-eligibility.js";

const live = "v1.0.31";

assert.equal(classifyReleaseTag("v1.0.35", { liveTag: live }).publishReady, true);
assert.equal(classifyReleaseTag("v1.0.31", { liveTag: live }).publishReady, false);
assert.equal(classifyReleaseTag("v1.0.31", { liveTag: live }).rollbackEligible, false);
assert.equal(classifyReleaseTag("v1.0.30", { liveTag: live }).rollbackEligible, true);
assert.equal(classifyReleaseTag("v1.0.35", { liveTag: live }).rollbackEligible, false);
assert.equal(classifyReleaseTag("v1.0.R2", { liveTag: live }).rollbackEligible, false);
assert.equal(classifyReleaseTag("v1.0.34-dev.5", { liveTag: live }).metadataReady, false);

const betaReady = classifyReleaseTag("v1.0.35-beta.0", {
  liveTag: live,
  releaseChannel: "Beta (Pre-release)",
});
assert.equal(betaReady.metadataReady, true);
assert.equal(betaReady.publishReady, true);

const betaBlockedProd = classifyReleaseTag("v1.0.35-beta.0", {
  liveTag: live,
  releaseChannel: "Production",
});
assert.equal(betaBlockedProd.publishReady, false);

const publishCheck = validateReleaseDispatch({
  actionType: "publish-tag - Publish existing git tag to marketplaces",
  targetTag: "v1.0.35",
  liveTag: live,
});
assert.equal(publishCheck.ok, true);

const rollbackCheck = validateReleaseDispatch({
  actionType: "rollback - Restore previous tag as a new version",
  targetTag: "v1.0.30",
  liveTag: live,
});
assert.equal(rollbackCheck.ok, true);

const rollbackLive = validateReleaseDispatch({
  actionType: "rollback - Restore previous tag as a new version",
  targetTag: live,
  liveTag: live,
});
assert.equal(rollbackLive.ok, false);

const syncCheck = validateReleaseDispatch({
  actionType: "sync-open-vsx - Fast sync to Open VSX canonical namespace",
  targetTag: "v1.0.35",
  liveTag: live,
});
assert.equal(syncCheck.ok, true);

const map = buildTagEligibilityMap(["v1.0.30", "v1.0.31", "v1.0.35", "v1.0.34-dev.5"], { liveTag: live });
assert.equal(map["v1.0.30"].rollbackEligible, true);
assert.equal(map["v1.0.35"].publishReady, true);

console.log("release-tag-eligibility.test.mjs: OK");
