import { writeSocialGalleryArtifact } from "./social-gallery-artifacts.js";
import {
  readSocialGalleryItem,
  updateSocialGalleryItem,
} from "./social-gallery-queue.js";

/**
 * Generate Lorapok-themed gallery asset for one queued item (SOCIAL-02).
 *
 * @param {Record<string, unknown>} env
 * @param {string} id
 */
export async function processSocialGalleryJob(env, id) {
  const item = await readSocialGalleryItem(env, id);
  if (!item) {
    return { ok: false, error: "Gallery item not found" };
  }
  if (item.status === "ready" && item.imageUrl) {
    return { ok: true, item, skipped: true, reason: "already_ready" };
  }
  if (item.status === "generating") {
    return { ok: true, item, skipped: true, reason: "already_generating" };
  }

  await updateSocialGalleryItem(env, id, { status: "generating", error: null });

  try {
    const artifact = await writeSocialGalleryArtifact(env, item);
    const next = await updateSocialGalleryItem(env, id, {
      status: "ready",
      imageUrl: artifact.imageUrl,
      storage: artifact.storage,
      r2Key: artifact.r2Key,
      error: null,
    });
    return { ok: true, item: next };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gallery generation failed";
    const failed = await updateSocialGalleryItem(env, id, {
      status: "failed",
      error: message,
    });
    return { ok: false, error: message, item: failed };
  }
}

/**
 * Process the newest pending gallery jobs (best-effort background drain).
 *
 * @param {Record<string, unknown>} env
 * @param {number} [limit]
 */
export async function processPendingSocialGalleryJobs(env, limit = 3) {
  const { listSocialGalleryQueue } = await import("./social-gallery-queue.js");
  const { items } = await listSocialGalleryQueue(env, 20);
  const pending = items.filter((item) => item.status === "pending").slice(0, limit);
  const results = [];
  for (const item of pending) {
    results.push(await processSocialGalleryJob(env, String(item.id)));
  }
  return { processed: results.length, results };
}
