import assert from "node:assert/strict";
import {
  buildVoiceoverScript,
  isVideoEncoderAvailable,
  requestVideoEncode,
  resolveVideoEncoder,
} from "./social-video-encoder.js";
import { generateSocialVideoManifest } from "./social-ai-generate.js";

const script = buildVoiceoverScript("v1.0.40", "Title\n\n- Beta fix\n- SEO hub");
assert.match(script, /1\.0\.40/);
assert.match(script, /Beta fix/);
assert.match(script, /Lorapok Labs/);

assert.equal(isVideoEncoderAvailable({}, {}), false);
assert.equal(
  isVideoEncoderAvailable({}, { encoderUrl: "https://encoder.example/encode" }),
  true
);
assert.equal(resolveVideoEncoder({}, { encoderUrl: "not-a-url" }), null);

const serviceEnv = {
  VIDEO_ENCODER: {
    fetch: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          contentType: "video/mp4",
          videoBase64: btoa("fake-mp4-bytes"),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ),
  },
};
const service = resolveVideoEncoder(serviceEnv, {});
assert.equal(service?.kind, "service");

const encoded = await requestVideoEncode(service, {
  tag: "v1.0.40",
  aspectRatio: "9:16",
  secondsPerFrame: 3,
  template: "carousel",
  voiceoverEnabled: true,
  voiceoverScript: script,
  frames: [{ index: 0, caption: "Beta fix", svg: "<svg/>" }],
});
assert.equal(encoded.ok, true);
assert.ok(encoded.bytes);
assert.equal(encoded.encoderKind, "service");

const kv = {
  get: async () =>
    JSON.stringify({
      video: {
        enabled: true,
        template: "carousel",
        aspectRatio: "9:16",
        voiceoverEnabled: true,
        encoderUrl: "https://encoder.example/encode",
        secondsPerFrame: 2,
      },
    }),
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      ok: true,
      videoUrl: "https://cdn.example/clip.mp4",
      contentType: "video/mp4",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
try {
  const manifest = await generateSocialVideoManifest(
    { ADMIN_KV: kv },
    { tag: "v1.0.40", caption: "Title\n\n- Beta fix" }
  );
  assert.equal(manifest.enabled, true);
  assert.equal(manifest.encoded, true);
  assert.equal(manifest.videoUrl, "https://cdn.example/clip.mp4");
  assert.ok(manifest.voiceoverScript);
  assert.equal(manifest.encoderAvailable, true);
} finally {
  globalThis.fetch = originalFetch;
}

const fallback = await generateSocialVideoManifest(
  { ADMIN_KV: { get: async () => JSON.stringify({ video: { enabled: true } }) } },
  { tag: "v1.0.40", caption: "Title\n\n- Beta fix" }
);
assert.equal(fallback.encoded, false);
assert.match(fallback.note, /Static carousel|encoder/i);

console.log("social-video-encoder.test.mjs: OK");
