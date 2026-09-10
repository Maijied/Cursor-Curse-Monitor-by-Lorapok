import assert from "node:assert/strict";
import {
  mergeSocialAiConfigUpdate,
  mergeSocialAiProviderUpdate,
  mergeSocialAiVideoUpdate,
  readSocialAiConfig,
  sanitizeSocialAiConfigForClient,
  validateImageProvider,
  writeSocialAiConfig,
} from "./social-ai-config.js";

assert.equal(validateImageProvider({ id: "pollinations" }).ok, true);
assert.equal(validateImageProvider({ id: "openai", tier: "paid" }).ok, false);

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
};

const defaultConfig = await readSocialAiConfig(env);
assert.equal(defaultConfig.activeProviderId, "svg-fallback");

const activated = mergeSocialAiProviderUpdate(defaultConfig, {
  providerId: "pollinations",
  activate: true,
});
assert.equal(activated.activeProviderId, "pollinations");

const withVideo = mergeSocialAiVideoUpdate(activated, {
  enabled: true,
  template: "carousel",
  aspectRatio: "9:16",
});
assert.equal(withVideo.video.enabled, true);

await writeSocialAiConfig(env, withVideo);
const stored = await readSocialAiConfig(env);
assert.equal(stored.activeProviderId, "pollinations");

const client = sanitizeSocialAiConfigForClient(stored);
assert.ok(client.providers.some((entry) => entry.id === "pollinations" && entry.active));

const merged = mergeSocialAiConfigUpdate(stored, { activeProviderId: "svg-fallback" });
assert.equal(merged.activeProviderId, "svg-fallback");

console.log("social-ai-config.test.mjs: OK");
