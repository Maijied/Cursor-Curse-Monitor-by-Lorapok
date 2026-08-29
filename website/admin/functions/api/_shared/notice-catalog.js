import embedded from "./product-context.embedded.json" with { type: "json" };
import { hydrateTemplateValue } from "./product-context-runtime.js";

/** Static embedded snapshot (may contain {{placeholders}}). Prefer async getters with env. */
export const GENERATED_DEV_NOTICE = embedded.generatedDevNotice;

export const CONVERSATION_RECOVERY_NOTICE = embedded.conversationRecoveryNotice;

export const ROLLBACK_NOTICE = embedded.rollbackNotice;

export const BUILTIN_NOTICES = embedded.builtinNotices ?? [];

export function buildBuiltinNotices() {
  return embedded.builtinNotices ?? [];
}

/**
 * @param {Record<string, unknown>} [env]
 */
export async function getNoticeTemplates(env) {
  return hydrateTemplateValue(embedded.noticeTemplates ?? [], env);
}

/**
 * @param {Record<string, unknown>} [env]
 */
export async function getHydratedBuiltinNotices(env) {
  return hydrateTemplateValue(embedded.builtinNotices ?? [], env);
}

/**
 * @param {Record<string, unknown>} [env]
 */
export async function getGeneratedDevNotice(env) {
  return hydrateTemplateValue(embedded.generatedDevNotice, env);
}

/**
 * @param {Record<string, unknown>} [env]
 */
export async function getConversationRecoveryNotice(env) {
  return hydrateTemplateValue(embedded.conversationRecoveryNotice, env);
}

/**
 * @param {Record<string, unknown>} [env]
 */
export async function getRollbackNotice(env) {
  return hydrateTemplateValue(embedded.rollbackNotice, env);
}

export const productContext = embedded.ctx;
