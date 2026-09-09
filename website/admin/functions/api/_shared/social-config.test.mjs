import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SOCIAL_PLATFORMS,
  mergeSocialPlatformUpdate,
  sanitizeSocialConfigForClient,
  validateSocialPlatform,
} from "./social-config.js";
import { buildSocialPostText, listSocialPostPreviews } from "./social-post-templates.js";
import { runSocialTestMatrix } from "./social-notify.js";

describe("social-config", () => {
  it("validates telegram credentials when enabled", () => {
    assert.equal(
      validateSocialPlatform("telegram", {
        enabled: true,
        botToken: "123456:ABC-DEF",
        chatId: "-100123",
      }).ok,
      true
    );
    assert.equal(
      validateSocialPlatform("telegram", { enabled: true, botToken: "bad", chatId: "1" }).ok,
      false
    );
  });

  it("merges platform updates without wiping secrets", () => {
    const current = {
      telegram: { enabled: true, botToken: "123:token", chatId: "99" },
      updatedAt: null,
      updatedBy: null,
    };
    const next = mergeSocialPlatformUpdate(current, "telegram", { chatId: "100" });
    assert.equal(next.telegram.chatId, "100");
    assert.equal(next.telegram.botToken, "123:token");
  });

  it("sanitizes secrets for client responses", () => {
    const sanitized = sanitizeSocialConfigForClient({
      telegram: { enabled: true, botToken: "123456789:abcdefghijklmnop", chatId: "42" },
      mastodon: { enabled: false, instanceUrl: "", accessToken: "" },
      bluesky: { enabled: false, handle: "", appPassword: "" },
      x: { enabled: false, bearerToken: "" },
      linkedin: { enabled: false, accessToken: "", authorUrn: "" },
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedBy: "ops@lorapok.tech",
    });
    assert.equal(sanitized.platforms.telegram.botTokenPreview, "···mnop");
    assert.equal(sanitized.enabledCount, 1);
    assert.equal(SOCIAL_PLATFORMS.length, 5);
  });
});

describe("social-post-templates", () => {
  it("builds deploy digest caption", () => {
    const text = buildSocialPostText("deploy-digest", {
      version: "1.2.3",
      changelog: "- Fixed stats\n- Improved mail",
    });
    assert.match(text, /Cursor Curse Monitor 1\.2\.3/);
    assert.match(text, /Fixed stats/);
  });

  it("lists preview cards", () => {
    const previews = listSocialPostPreviews();
    assert.equal(previews.length, 3);
  });
});

describe("social-notify matrix", () => {
  it("dry-run skips live network calls", async () => {
    const matrix = await runSocialTestMatrix(
      {
        telegram: { enabled: true, botToken: "123:abc", chatId: "1" },
        mastodon: { enabled: false, instanceUrl: "", accessToken: "" },
        bluesky: { enabled: false, handle: "", appPassword: "" },
        x: { enabled: false, bearerToken: "" },
        linkedin: { enabled: false, accessToken: "", authorUrn: "" },
      },
      "community",
      { dryRun: true }
    );
    assert.equal(matrix.results.length, 5);
    assert.equal(matrix.results[0].ok, true);
    assert.equal(matrix.results[0].dryRun, true);
    assert.equal(matrix.results[1].skipped, true);
  });
});
