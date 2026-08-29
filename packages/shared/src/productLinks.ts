/** Canonical Lorapok product URLs — shared by IDE extension, browser extension, and admin. */

import { PLATFORM_LINKS } from "./platformAvailability";

export { PRODUCT_HOMEPAGE } from "./platformAvailability";

export const PRODUCT_PRIVACY_URL = "https://cursor.lorapok.tech/privacy.html";
export const ADMIN_PANEL_URL = "https://cursor-dev.lorapok.tech";
export const LORAPOK_LABS_URL = "https://lorapok.tech";

export const SUPPORT_EMAIL = "cursor.curse.help@lorapok.tech";
export const PRODUCT_EMAIL = "cursor.monitor@lorapok.tech";

export const GITHUB_REPO = "Maijied/Cursor-Curse-Monitor-by-Lorapok";
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;
export const GITHUB_RELEASES_URL = PLATFORM_LINKS.github.url;
export const GITHUB_ISSUES_URL = `${GITHUB_REPO_URL}/issues`;
export const GITHUB_NEW_ISSUE_URL = `${GITHUB_REPO_URL}/issues/new/choose`;

export const VSCODE_MARKETPLACE_URL = PLATFORM_LINKS.vscode.url;
export const OPEN_VSX_URL = PLATFORM_LINKS.openVsx.url;
export const FIREFOX_AMO_URL = PLATFORM_LINKS.firefox.url;

export type FeedbackKind = "bug" | "feature" | "general";

export function buildFeedbackMailto(params: {
  kind?: FeedbackKind;
  version?: string;
  editor?: string;
  accountHint?: string;
}): string {
  const kind = params.kind ?? "general";
  const subject = encodeURIComponent(
    `[Cursor Curse Monitor] ${kind === "bug" ? "Bug report" : kind === "feature" ? "Feature request" : "Feedback"}`
  );
  const lines = [
    "Describe your feedback below:",
    "",
    "---",
    `Kind: ${kind}`,
    params.version ? `Extension version: ${params.version}` : "",
    params.editor ? `Editor: ${params.editor}` : "",
    params.accountHint ? `Account: ${params.accountHint}` : "",
    `Sent from: Cursor Curse Monitor`,
  ].filter(Boolean);
  const body = encodeURIComponent(lines.join("\n"));
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}

export function buildGithubFeedbackUrl(kind: FeedbackKind = "general"): string {
  const labels =
    kind === "bug" ? "bug" : kind === "feature" ? "enhancement" : "feedback";
  return `${GITHUB_NEW_ISSUE_URL}?labels=${encodeURIComponent(labels)}&template=feedback.md`;
}
