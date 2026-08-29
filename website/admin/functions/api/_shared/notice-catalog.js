import embedded from "./product-context.embedded.json" with { type: "json" };
import { hydrateTemplateValue } from "./product-context-runtime.js";

/** Static embedded snapshot (may contain {{placeholders}}). Prefer async getters with env. */
export const GENERATED_DEV_NOTICE = embedded.generatedDevNotice;

export const CONVERSATION_RECOVERY_NOTICE = embedded.conversationRecoveryNotice;

export const ROLLBACK_NOTICE = embedded.rollbackNotice;

export const BUILTIN_NOTICES = embedded.builtinNotices ?? [];

/**
 * Provides the embedded built-in notices.
 * @returns {Array} The embedded built-in notices, or an empty array when none are available.
 */
export function buildBuiltinNotices() {
  return embedded.builtinNotices ?? [];
}

/**
 * Gets the embedded notice templates with environment values substituted.
 * @param {Record<string, unknown>} [env] - Values used to hydrate template placeholders.
 * @returns {unknown[]} The hydrated notice templates.
 */
export async function getNoticeTemplates(env) {
  return hydrateTemplateValue(embedded.noticeTemplates ?? [], env);
}

/**
 * Hydrates the embedded built-in notice templates with environment values.
 * @param {Record<string, unknown>} [env] - Values used to replace template placeholders.
 * @return {Array<unknown>} The hydrated built-in notices.
 */
export async function getHydratedBuiltinNotices(env) {
  return hydrateTemplateValue(embedded.builtinNotices ?? [], env);
}

/**
 * Retrieves the generated development notice with environment values applied.
 * @param {Record<string, unknown>} [env] - Values used to hydrate template placeholders.
 * @return {Promise<unknown>} The hydrated generated development notice.
 */
export async function getGeneratedDevNotice(env) {
  return hydrateTemplateValue(embedded.generatedDevNotice, env);
}

/**
 * Retrieves the conversation recovery notice with environment values applied.
 * @param {Record<string, unknown>} [env] - Environment values used to hydrate template placeholders.
 * @return {*} The hydrated conversation recovery notice.
 */
export async function getConversationRecoveryNotice(env) {
  return hydrateTemplateValue(embedded.conversationRecoveryNotice, env);
}

/**
 * Retrieves the rollback notice with its template values hydrated.
 * @param {Record<string, unknown>} [env] - Environment values used to replace template placeholders.
 * @returns {unknown} The hydrated rollback notice.
 */
export async function getRollbackNotice(env) {
  return hydrateTemplateValue(embedded.rollbackNotice, env);
}

export const productContext = embedded.ctx;
