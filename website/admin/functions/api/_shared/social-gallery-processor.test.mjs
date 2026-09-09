import assert from "node:assert/strict";
import {
  buildSocialGallerySvg,
  socialGalleryAssetPublicUrl,
} from "./social-gallery-artifacts.js";
import { processSocialGalleryJob } from "./social-gallery-processor.js";
import { queueSocialGalleryJob } from "./social-gallery-queue.js";

assert.match(buildSocialGallerySvg("v1.0.31", "Cursor Curse Monitor 1.0.31\n\n- Beta fix"), /Cursor Curse Monitor 1\.0\.31/);

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
  ADMIN_PUBLIC_URL: "https://cursor-dev.lorapok.tech",
  GITHUB_TOKEN: "",
};

const queued = await queueSocialGalleryJob(env, {
  tag: "v1.0.31",
  actionType: "publish-tag - Publish existing git tag to marketplaces",
  source: "test",
});
assert.equal(queued.ok, true);
assert.ok(queued.item?.id);

const id = String(queued.item.id);
await new Promise((resolve) => setTimeout(resolve, 50));

const generated = await processSocialGalleryJob(env, id);
assert.equal(generated.ok, true);
assert.equal(generated.item?.status, "ready");
assert.ok(generated.item?.imageUrl);
assert.equal(generated.item.imageUrl, socialGalleryAssetPublicUrl(env, id));

console.log("social-gallery-processor.test.mjs: OK");
