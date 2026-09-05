/**
 * AUTH-12 — UI feature → permission mapping (mirrors server rbac-routes + page actions).
 */

export type FeaturePermission =
  | "notices.write"
  | "subscribers.write"
  | "mail.send"
  | "team.manage"
  | "secrets.manage"
  | "deploy.run"
  | "deploy.infra"
  | "settings.write"
  | "integrations.write"
  | "mail.provision";

/** Named UI features for docs and tests. */
export const UI_FEATURE_PERMISSIONS: Record<string, FeaturePermission> = {
  "notices.editor": "notices.write",
  "notices.publish": "notices.write",
  "notices.delete": "notices.write",
  "subscribers.broadcast": "subscribers.write",
  "mailbox.compose": "mail.send",
  "mailbox.test-send": "mail.send",
  "mailbox.sync-infra": "deploy.infra",
  "team.invite": "team.manage",
  "team.role-change": "team.manage",
  "team.remove": "team.manage",
  "cred-vault.manage": "secrets.manage",
  "deploy.release": "deploy.run",
  "deploy.rollback": "deploy.run",
  "deploy.infra": "deploy.infra",
};
