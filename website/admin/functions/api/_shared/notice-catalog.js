import embedded from "./product-context.embedded.json" with { type: "json" };

const ctx = embedded.ctx;

export const GENERATED_DEV_NOTICE = embedded.generatedDevNotice;

export const CONVERSATION_RECOVERY_NOTICE = embedded.conversationRecoveryNotice;

export const ROLLBACK_NOTICE = embedded.rollbackNotice;

export const BUILTIN_NOTICES = embedded.builtinNotices ?? [];

export function buildBuiltinNotices() {
  return embedded.builtinNotices ?? [];
}

export function getNoticeTemplates() {
  return embedded.noticeTemplates ?? [];
}

export { ctx as productContext };
