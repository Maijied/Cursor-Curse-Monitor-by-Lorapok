import assert from "node:assert/strict";
import {
  buildSocialGalleryCaption,
  queueSocialGalleryJob,
  shouldQueueSocialGallery,
} from "./social-gallery-queue.js";

assert.equal(shouldQueueSocialGallery("publish-tag - Publish existing git tag to marketplaces"), true);
assert.equal(shouldQueueSocialGallery("deploy-infra - Deploy Mission Control admin & marketing site"), false);
assert.equal(shouldQueueSocialGallery("seo-refresh"), false);

const caption = buildSocialGalleryCaption("v1.0.31", "### Fixed\n- Beta pipeline\n- Open VSX lag");
assert.match(caption, /Cursor Curse Monitor 1\.0\.31/);
assert.match(caption, /Beta pipeline/);

const kv = new Map();
const env = {
  ADMIN_KV: {
    async get(key) {
      return kv.get(key) ?? null;
    },
    async put(key, value) {
      kv.set(key, value);
    },
  },
  GITHUB_TOKEN: "",
};

const first = await queueSocialGalleryJob(env, {
  tag: "v1.0.31",
  actionType: "publish-tag - Publish existing git tag to marketplaces",
  runUrl: "https://github.com/example/actions/runs/1",
  source: "test",
});
assert.equal(first.ok, true);
assert.equal(first.skipped, undefined);
assert.equal(first.item?.status, "pending");
assert.equal(first.item?.tag, "v1.0.31");

const duplicate = await queueSocialGalleryJob(env, {
  tag: "v1.0.31",
  actionType: "publish-tag - Publish existing git tag to marketplaces",
  source: "test",
});
assert.equal(duplicate.skipped, true);
assert.equal(duplicate.reason, "already_queued");

const skipped = await queueSocialGalleryJob(env, {
  tag: "v1.0.32",
  actionType: "deploy-infra - Deploy Mission Control admin & marketing site",
});
assert.equal(skipped.skipped, true);
assert.equal(skipped.reason, "action_not_eligible");

console.log("social-gallery-queue.test.mjs: OK");
