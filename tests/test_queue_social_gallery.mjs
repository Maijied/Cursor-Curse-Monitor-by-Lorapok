import assert from "node:assert/strict";
import {
  parseQueueSocialGalleryArgs,
  queueSocialGalleryFromCi,
} from "../scripts/queue-social-gallery.mjs";

const parsed = parseQueueSocialGalleryArgs([
  "node",
  "queue-social-gallery.mjs",
  "--action-type",
  "publish-tag - Publish existing git tag to marketplaces",
  "--tag",
  "v1.0.31",
]);
assert.equal(parsed.tag, "v1.0.31");
assert.match(parsed.actionType, /publish-tag/);

const skipped = await queueSocialGalleryFromCi({
  actionType: "deploy-infra - Deploy Mission Control admin & marketing site",
  tag: "v1.0.31",
  adminUrl: "https://example.test",
});
assert.equal(skipped.skipped, true);
assert.equal(skipped.reason, "action_not_eligible");

const noSecret = await queueSocialGalleryFromCi({
  actionType: "publish-tag - Publish existing git tag to marketplaces",
  tag: "v1.0.31",
  adminUrl: "https://example.test",
});
assert.equal(noSecret.skipped, true);
assert.equal(noSecret.reason, "no_cron_secret");

console.log("test_queue_social_gallery.mjs: OK");
