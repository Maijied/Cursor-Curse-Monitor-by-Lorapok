import assert from "node:assert/strict";
import {
  buildCarouselFrames,
  buildImagePrompt,
  dimensionsForAspectRatio,
  generateSocialVideoManifest,
} from "./social-ai-generate.js";

const prompt = buildImagePrompt("v1.0.31", "Cursor Curse Monitor 1.0.31\n\n- Beta fix", {
  promptPrefix: "Lorapok deploy card",
});
assert.match(prompt, /1\.0\.31/);
assert.match(prompt, /Lorapok deploy card/);

const square = dimensionsForAspectRatio("1:1");
assert.equal(square.width, 1080);
assert.equal(square.height, 1080);

const story = dimensionsForAspectRatio("9:16");
assert.equal(story.height, 1920);

const frames = buildCarouselFrames(
  "v1.0.31",
  "Cursor Curse Monitor 1.0.31\n\n- Beta fix\n- SEO hub",
  "9:16"
);
assert.ok(frames.length >= 2);
assert.match(frames[0].svg, /<svg/);

const env = { ADMIN_KV: { get: async () => null } };
const manifest = await generateSocialVideoManifest(env, {
  tag: "v1.0.31",
  caption: "Cursor Curse Monitor 1.0.31\n\n- Beta fix\n- SEO hub",
});
assert.equal(manifest.enabled, false);
assert.equal(manifest.frameCount, frames.length);
assert.ok(manifest.frames.length >= 2);

console.log("social-ai-generate.test.mjs: OK");
