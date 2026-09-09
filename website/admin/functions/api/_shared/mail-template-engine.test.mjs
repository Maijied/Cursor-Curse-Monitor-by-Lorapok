import assert from "node:assert/strict";
import test from "node:test";
import {
  subscriberDisplayName,
  formatSubscriberPlatform,
  buildSubscriberMergeContext,
} from "./subscriber-mail-context.js";
import { interpolateString } from "./template-interpolate.js";
import { renderMailTemplate } from "./mail-template-engine.js";
import { normalizeMailTemplateOverrides } from "./mail-templates-kv.js";

test("subscriberDisplayName capitalizes email local part", () => {
  assert.equal(subscriberDisplayName("jane.doe@example.com"), "Jane doe");
  assert.equal(subscriberDisplayName(""), "there");
});

test("formatSubscriberPlatform maps known sources", () => {
  assert.equal(formatSubscriberPlatform("website"), "Website");
  assert.equal(formatSubscriberPlatform("browser-extension"), "Browser extension");
});

test("buildSubscriberMergeContext includes merge tags", () => {
  const ctx = buildSubscriberMergeContext(
    {
      email: "user@example.com",
      subscribedAt: new Date().toISOString(),
      source: "website",
      installId: null,
      consentVersion: "2026-08-25",
    },
    {
      displayName: "Cursor Curse Monitor",
      homepage: "https://cursor.lorapok.tech",
      releaseVersion: "1.0.51",
      releaseUrl: "https://github.com/example/releases/tag/v1.0.51",
    },
    { githubCommunity: { totalDownloads: 1200 } },
    { ADMIN_PUBLIC_URL: "https://cursor-dev.lorapok.tech" }
  );
  assert.equal(ctx.email, "user@example.com");
  assert.equal(ctx.name, "User");
  assert.equal(ctx.platform, "Website");
  assert.match(ctx.stats, /1\.0\.51/);
  assert.ok(ctx.unsubscribeHint);
  assert.ok(ctx.unsubscribeUrl.includes("cursor.lorapok.tech"));
});

test("interpolateString replaces subscriber merge tags", () => {
  const out = interpolateString("Hi {{name}} on {{platform}} — {{stats}}", {
    name: "Alex",
    platform: "Website",
    stats: "Latest release v1.0.51",
  });
  assert.match(out, /Hi Alex on Website/);
});

test("normalizeMailTemplateOverrides keeps subject/text overrides", () => {
  const normalized = normalizeMailTemplateOverrides({
    overrides: {
      "subscribe-welcome": { subject: "Custom welcome", enabled: true },
    },
  });
  assert.equal(normalized.overrides["subscribe-welcome"].subject, "Custom welcome");
});

test("renderMailTemplate produces branded subscribe welcome", async () => {
  const env = { SKIP_LIVE_SITE_DATA: "true", PREFER_LOCAL_SITE_DATA: "true" };
  const rendered = await renderMailTemplate(env, "subscribe-welcome", {
    email: "test@example.com",
    name: "Test",
    platform: "Website",
    stats: "Latest release v1.0.51",
    displayName: "Cursor Curse Monitor",
    homepage: "https://cursor.lorapok.tech",
    unsubscribeHint: "Reply to unsubscribe.",
  });
  assert.match(rendered.subject, /subscribed/i);
  assert.match(rendered.html, /Lorapok Labs/);
  assert.match(rendered.text, /Hi Test/);
  assert.equal(rendered.category, "subscribe");
});
