/**
 * Mail ops service boundary — send/replay/redirect/audit for scripts and workers.
 * Pages API handlers import functions/api/_shared/mail.js; CLI uses this module.
 */
export { resolveMailRedirectTo, resolveMailServiceEnv } from "./config.js";
export {
  MAILBOX_KEY,
  D1_DATABASE,
  runD1Query,
  d1RowToMessage,
  loadD1MailMessages,
  loadMailboxReplayMessages,
  isReplayable,
  buildReplayPayload,
  listAuditSummary,
  maskEmail,
  maskEmailDisplay,
} from "./replay.js";

export { sendMail } from "../../functions/api/_shared/mail.js";
export { logResendMailEvent, MAIL_AUDIT_RESEND_PREFIX } from "../../functions/api/_shared/mail-audit-log.js";
export { resolveMailCredentials, resolveAdminMasterEmailFromEnv } from "../../scripts/lib/mail-credentials.mjs";
export { resolveLocalMailEnv, resolveLocalMailEnvAsync } from "../../scripts/lib/resolve-local-mail-env.mjs";
