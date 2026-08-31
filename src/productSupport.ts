import * as vscode from "vscode";
import {
  ADMIN_PANEL_URL,
  buildFeedbackMailto,
  buildGithubFeedbackUrl,
  type FeedbackKind,
  FIREFOX_AMO_URL,
  GITHUB_RELEASES_URL,
  OPEN_VSX_URL,
  PRODUCT_HOMEPAGE,
  PRODUCT_PRIVACY_URL,
  SUPPORT_EMAIL,
  VSCODE_MARKETPLACE_URL,
} from "@lorapok/cursor-monitor-shared";
import { FeedbackPanel } from "./feedbackPanel";

function editorLabel(): string {
  const app = vscode.env.appName || "VS Code";
  const host = vscode.env.uiKind === vscode.UIKind.Web ? " (web)" : "";
  return `${app}${host} ${vscode.version}`;
}

export async function showExtensionInfo(context: vscode.ExtensionContext): Promise<void> {
  const version = String(context.extension.packageJSON.version ?? "0.0.0");
  const isPrerelease = /beta|alpha|rc/i.test(version);

  type InfoItem = vscode.QuickPickItem & {
    infoAction:
      | "home"
      | "releases"
      | "vscode"
      | "ovsx"
      | "firefox"
      | "privacy"
      | "settings";
  };
  const pick = await vscode.window.showQuickPick<InfoItem>(
    [
      {
        label: "$(home) Product website",
        description: PRODUCT_HOMEPAGE,
        infoAction: "home",
      },
      {
        label: "$(github) GitHub releases & VSIX",
        description: "Install beta builds from pre-release assets",
        infoAction: "releases",
      },
      {
        label: "$(extensions) VS Code Marketplace",
        description: VSCODE_MARKETPLACE_URL,
        infoAction: "vscode",
      },
      {
        label: "$(cloud-download) Open VSX",
        description: OPEN_VSX_URL,
        infoAction: "ovsx",
      },
      {
        label: "$(globe) Firefox add-on",
        description: FIREFOX_AMO_URL,
        infoAction: "firefox",
      },
      {
        label: "$(shield) Privacy policy",
        description: PRODUCT_PRIVACY_URL,
        infoAction: "privacy",
      },
      {
        label: "$(settings-gear) Extension settings",
        description: "Cursor Curse Monitor configuration",
        infoAction: "settings",
      },
    ],
    {
      title: `Cursor Curse Monitor v${version}${isPrerelease ? " (pre-release)" : ""}`,
      placeHolder: "About this extension — choose a link to open",
      ignoreFocusOut: true,
    }
  );

  if (!pick) return;

  switch (pick.infoAction) {
    case "home":
      await vscode.env.openExternal(vscode.Uri.parse(PRODUCT_HOMEPAGE));
      break;
    case "releases":
      await vscode.env.openExternal(vscode.Uri.parse(GITHUB_RELEASES_URL));
      break;
    case "vscode":
      await vscode.env.openExternal(vscode.Uri.parse(VSCODE_MARKETPLACE_URL));
      break;
    case "ovsx":
      await vscode.env.openExternal(vscode.Uri.parse(OPEN_VSX_URL));
      break;
    case "firefox":
      await vscode.env.openExternal(vscode.Uri.parse(FIREFOX_AMO_URL));
      break;
    case "privacy":
      await vscode.env.openExternal(vscode.Uri.parse(PRODUCT_PRIVACY_URL));
      break;
    case "settings":
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "@ext:LorapokLabs.cursor-curse-monitor-by-lorapok"
      );
      break;
  }
}

export async function sendFeedback(context: vscode.ExtensionContext): Promise<void> {
  const version = String(context.extension.packageJSON.version ?? "0.0.0");
  type KindItem = vscode.QuickPickItem & { feedbackKind: FeedbackKind };
  const kindPick = await vscode.window.showQuickPick<KindItem>(
    [
      { label: "$(bug) Report a bug", feedbackKind: "bug" },
      { label: "$(lightbulb) Request a feature", feedbackKind: "feature" },
      { label: "$(comment) General feedback", feedbackKind: "general" },
    ],
    {
      title: "Send feedback",
      placeHolder: `We read every message — support: ${SUPPORT_EMAIL}`,
    }
  );
  if (!kindPick) return;

  type ChannelItem = vscode.QuickPickItem & { channelAction: "discord" | "email" | "github" | "admin" };
  const channel = await vscode.window.showQuickPick<ChannelItem>(
    [
      {
        label: "$(comment-discussion) Send in-app (Discord + Mission Control)",
        description: "Opens feedback form — synced with community Discord",
        channelAction: "discord",
      },
      {
        label: "$(mail) Email Lorapok support",
        description: SUPPORT_EMAIL,
        channelAction: "email",
      },
      {
        label: "$(github) GitHub issue (public)",
        description: "Prefilled feedback template",
        channelAction: "github",
      },
      {
        label: "$(globe) Mission Control admin",
        description: ADMIN_PANEL_URL,
        channelAction: "admin",
      },
    ],
    {
      title: "How should we receive this?",
      placeHolder: "In-app feedback posts to Discord and admin logs",
    }
  );
  if (!channel) return;

  if (channel.channelAction === "discord") {
    FeedbackPanel.show(context, kindPick.feedbackKind);
    return;
  }

  if (channel.channelAction === "email") {
    const mailto = buildFeedbackMailto({
      kind: kindPick.feedbackKind,
      version,
      editor: editorLabel(),
    });
    await vscode.env.openExternal(vscode.Uri.parse(mailto));
    return;
  }

  if (channel.channelAction === "github") {
    await vscode.env.openExternal(vscode.Uri.parse(buildGithubFeedbackUrl(kindPick.feedbackKind)));
    return;
  }

  await vscode.env.openExternal(vscode.Uri.parse(ADMIN_PANEL_URL));
}
