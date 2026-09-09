import {
  SOCIAL_PLATFORMS,
  readSocialConfig,
  validateSocialPlatform,
} from "./social-config.js";
import { buildSocialPostText, buildSocialPublishText } from "./social-post-templates.js";

/**
 * @param {Response} res
 */
async function readJsonOrText(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * @param {Record<string, unknown>} platformConfig
 * @param {string} text
 * @param {{ dryRun?: boolean; imageUrl?: string | null }} [options]
 */
export async function sendTelegramPost(platformConfig, text, options = {}) {
  if (options.dryRun) return { ok: true, platform: "telegram", dryRun: true };
  const botToken = String(platformConfig.botToken ?? "");
  const chatId = String(platformConfig.chatId ?? "");
  const imageUrl = String(options.imageUrl ?? "").trim();
  const endpoint = imageUrl ? "sendPhoto" : "sendMessage";
  const url = `https://api.telegram.org/bot${botToken}/${endpoint}`;
  const body = imageUrl
    ? { chat_id: chatId, photo: imageUrl, caption: text.slice(0, 1024) }
    : { chat_id: chatId, text, disable_web_page_preview: false };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJsonOrText(res);
  if (!res.ok || data.ok === false) {
    return {
      ok: false,
      platform: "telegram",
      error: data.description ?? data.error ?? `HTTP ${res.status}`,
    };
  }
  return { ok: true, platform: "telegram", id: data.result?.message_id ?? null };
}

/**
 * @param {Record<string, unknown>} platformConfig
 * @param {string} text
 * @param {{ dryRun?: boolean }} [options]
 */
export async function sendMastodonPost(platformConfig, text, options = {}) {
  if (options.dryRun) return { ok: true, platform: "mastodon", dryRun: true };
  const instanceUrl = String(platformConfig.instanceUrl ?? "").replace(/\/+$/, "");
  const accessToken = String(platformConfig.accessToken ?? "");
  const res = await fetch(`${instanceUrl}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: text }),
  });
  const data = await readJsonOrText(res);
  if (!res.ok) {
    return {
      ok: false,
      platform: "mastodon",
      error: data.error ?? data.error_description ?? `HTTP ${res.status}`,
    };
  }
  return { ok: true, platform: "mastodon", id: data.id ?? null, url: data.url ?? null };
}

/**
 * @param {Record<string, unknown>} platformConfig
 * @param {string} text
 * @param {{ dryRun?: boolean }} [options]
 */
export async function sendBlueskyPost(platformConfig, text, options = {}) {
  if (options.dryRun) return { ok: true, platform: "bluesky", dryRun: true };
  const handle = String(platformConfig.handle ?? "").replace(/^@/, "");
  const appPassword = String(platformConfig.appPassword ?? "");
  const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });
  const session = await readJsonOrText(sessionRes);
  if (!sessionRes.ok) {
    return {
      ok: false,
      platform: "bluesky",
      error: session.message ?? session.error ?? `Session HTTP ${sessionRes.status}`,
    };
  }

  const postRes = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: {
        text,
        createdAt: new Date().toISOString(),
      },
    }),
  });
  const post = await readJsonOrText(postRes);
  if (!postRes.ok) {
    return {
      ok: false,
      platform: "bluesky",
      error: post.message ?? post.error ?? `Post HTTP ${postRes.status}`,
    };
  }
  return { ok: true, platform: "bluesky", id: post.uri ?? null };
}

/**
 * @param {Record<string, unknown>} platformConfig
 * @param {string} text
 * @param {{ dryRun?: boolean }} [options]
 */
export async function sendXPost(platformConfig, text, options = {}) {
  if (options.dryRun) return { ok: true, platform: "x", dryRun: true };
  const bearerToken = String(platformConfig.bearerToken ?? "");
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: text.slice(0, 280) }),
  });
  const data = await readJsonOrText(res);
  if (!res.ok) {
    return {
      ok: false,
      platform: "x",
      error: data.detail ?? data.title ?? data.error ?? `HTTP ${res.status}`,
    };
  }
  return { ok: true, platform: "x", id: data.data?.id ?? null };
}

/**
 * @param {Record<string, unknown>} platformConfig
 * @param {string} text
 * @param {{ dryRun?: boolean }} [options]
 */
export async function sendLinkedInPost(platformConfig, text, options = {}) {
  if (options.dryRun) return { ok: true, platform: "linkedin", dryRun: true };
  const accessToken = String(platformConfig.accessToken ?? "");
  const authorUrn = String(platformConfig.authorUrn ?? "");
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  const data = await readJsonOrText(res);
  if (!res.ok) {
    return {
      ok: false,
      platform: "linkedin",
      error: data.message ?? data.error ?? `HTTP ${res.status}`,
    };
  }
  return { ok: true, platform: "linkedin", id: data.id ?? null };
}

const SENDERS = {
  telegram: sendTelegramPost,
  mastodon: sendMastodonPost,
  bluesky: sendBlueskyPost,
  x: sendXPost,
  linkedin: sendLinkedInPost,
};

/**
 * @param {string} platform
 * @param {Record<string, unknown>} platformConfig
 * @param {string} text
 * @param {{ dryRun?: boolean; imageUrl?: string | null }} [options]
 */
export async function sendSocialPost(platform, platformConfig, text, options = {}) {
  const sender = SENDERS[platform];
  if (!sender) return { ok: false, platform, error: "Unknown platform" };
  const validation = validateSocialPlatform(platform, platformConfig);
  if (!validation.ok || !validation.enabled) {
    return { ok: false, platform, error: "Platform not configured", skipped: true };
  }
  const payloadText =
    options.imageUrl && platform !== "telegram"
      ? `${text}\n\n${options.imageUrl}`.slice(0, platform === "x" ? 280 : 500)
      : text;
  return sender(platformConfig, payloadText, options);
}

/**
 * @param {Record<string, unknown>} config
 * @param {string} templateId
 * @param {{ platforms?: string[]; dryRun?: boolean; context?: Record<string, unknown> }} [options]
 */
export async function runSocialTestMatrix(config, templateId, options = {}) {
  const text = buildSocialPostText(templateId, options.context ?? {});
  const targets =
    options.platforms?.length > 0
      ? options.platforms.filter((platform) => SOCIAL_PLATFORMS.includes(platform))
      : SOCIAL_PLATFORMS;

  const results = [];
  for (const platform of targets) {
    const platformConfig = config[platform] ?? {};
    const validation = validateSocialPlatform(platform, platformConfig);
    if (!validation.ok || !validation.enabled) {
      results.push({
        ok: false,
        platform,
        skipped: true,
        error: validation.enabled === false ? "Disabled" : validation.error ?? "Not configured",
      });
      continue;
    }
    results.push(await sendSocialPost(platform, platformConfig, text, { dryRun: options.dryRun }));
  }

  return { templateId, text, results };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} templateId
 * @param {{ platforms?: string[]; dryRun?: boolean; context?: Record<string, unknown> }} [options]
 */
export async function runSocialTestFromEnv(env, templateId, options = {}) {
  const config = await readSocialConfig(env);
  return runSocialTestMatrix(config, templateId, options);
}

/**
 * Publish one social gallery item to configured platforms (SOCIAL-03).
 *
 * @param {Record<string, unknown>} config
 * @param {{ caption?: string | null; hashtags?: string | null; imageUrl?: string | null; status?: string | null }} item
 * @param {{ platforms?: string[]; dryRun?: boolean }} [options]
 */
export async function publishSocialGalleryItem(config, item, options = {}) {
  if (item.status && item.status !== "ready") {
    return { ok: false, error: `Gallery item is ${item.status}; generate asset first.` };
  }

  const text = buildSocialPublishText(item);
  const targets =
    options.platforms?.length > 0
      ? options.platforms.filter((platform) => SOCIAL_PLATFORMS.includes(platform))
      : SOCIAL_PLATFORMS;

  const results = [];
  for (const platform of targets) {
    const platformConfig = config[platform] ?? {};
    const validation = validateSocialPlatform(platform, platformConfig);
    if (!validation.ok || !validation.enabled) {
      results.push({
        ok: false,
        platform,
        skipped: true,
        error: validation.enabled === false ? "Disabled" : validation.error ?? "Not configured",
      });
      continue;
    }
    results.push(
      await sendSocialPost(platform, platformConfig, text, {
        dryRun: options.dryRun,
        imageUrl: item.imageUrl ?? null,
      })
    );
  }

  const sent = results.filter((entry) => entry.ok && !entry.dryRun).length;
  const skipped = results.filter((entry) => entry.skipped).length;
  const failed = results.filter((entry) => !entry.ok && !entry.skipped).length;

  return {
    ok: failed === 0,
    text,
    results,
    summary: { sent, skipped, failed, total: results.length },
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ caption?: string | null; hashtags?: string | null; imageUrl?: string | null; status?: string | null }} item
 * @param {{ platforms?: string[]; dryRun?: boolean }} [options]
 */
export async function publishSocialGalleryFromEnv(env, item, options = {}) {
  const config = await readSocialConfig(env);
  return publishSocialGalleryItem(config, item, options);
}
