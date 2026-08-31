import { SYSTEM_ACCOUNT_ID } from "@lorapok/cursor-monitor-shared";
import * as vscode from "vscode";
import {
  addSavedAccount,
  listPublicAccounts,
  removeSavedAccount,
  setActiveAccountId,
} from "./accountStore";
import { NotificationProvider } from "./notificationProvider";

const CURSOR_DASHBOARD_URL = "https://cursor.com/dashboard";

export async function promptPasteCursorToken(
  context: vscode.ExtensionContext
): Promise<boolean> {
  const token = await vscode.window.showInputBox({
    title: "Paste Cursor access token",
    prompt:
      "Paste the access token from cursorAuth/accessToken in state.vscdb, or from your browser session after signing in at cursor.com/dashboard.",
    placeHolder: "Cursor access token",
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      const trimmed = value.replace(/^Bearer\s+/i, "").trim();
      if (!trimmed) {
        return "Token is required";
      }
      if (trimmed.length < 20) {
        return "That does not look like a Cursor access token";
      }
      return null;
    },
  });
  if (!token) {
    return false;
  }

  const email = await vscode.window.showInputBox({
    title: "Account email (optional)",
    prompt: "Used as the label in the account switcher. Leave blank to detect from the token when possible.",
    placeHolder: "you@example.com",
    ignoreFocusOut: true,
    validateInput: (value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? null : "Enter a valid email or leave blank";
    },
  });
  if (email === undefined) {
    return false;
  }

  const added = await addSavedAccount(context, token, email.trim() || null);
  NotificationProvider.show({
    title: "Account added",
    message: added.email
      ? `Now monitoring ${added.email}. Token stored in this extension only — your IDE state.vscdb is not modified.`
      : "Now monitoring the saved login. Token stored in this extension only — your IDE state.vscdb is not modified.",
    type: "success",
    duration: 5000,
  });
  return true;
}

export async function promptLoginWithBrowser(
  context: vscode.ExtensionContext
): Promise<boolean> {
  await vscode.env.openExternal(vscode.Uri.parse(CURSOR_DASHBOARD_URL));
  const choice = await vscode.window.showInformationMessage(
    "Opened cursor.com/dashboard in your browser. Sign in there, then paste your access token here. If you use the Lorapok browser extension, it can capture the session automatically.",
    { modal: false },
    "Paste token",
    "Done"
  );
  if (choice === "Paste token") {
    return promptPasteCursorToken(context);
  }
  return false;
}

export async function promptAddCursorAccount(context: vscode.ExtensionContext): Promise<boolean> {
  const pick = await vscode.window.showQuickPick(
    [
      {
        label: "$(globe) Sign in with browser",
        description: "Open cursor.com/dashboard — works in Cursor or dCursor without a second install",
        id: "browser",
      },
      {
        label: "$(key) Paste access token",
        description: "Switch between multiple logins saved in this extension (Cursor / dCursor)",
        id: "paste",
      },
    ],
    {
      title: "Connect Cursor account",
      placeHolder: "Choose how to sign in",
      ignoreFocusOut: true,
    }
  );
  if (!pick) {
    return false;
  }
  if (pick.id === "browser") {
    return promptLoginWithBrowser(context);
  }
  return promptPasteCursorToken(context);
}

export async function promptSwitchCursorAccount(context: vscode.ExtensionContext): Promise<boolean> {
  const accounts = await listPublicAccounts(context);
  type AccountPick = vscode.QuickPickItem & { accountId: string };
  const items: AccountPick[] = [
    ...accounts.map((account) => ({
      label: account.label,
      description:
        account.source === "system"
          ? "This editor session (local DB for Composer insights)"
          : account.source === "discovered"
            ? "Read-only login from another install on this PC"
            : "Saved token (extension secrets only)",
      accountId: account.id,
    })),
    {
      label: "$(add) Add another Cursor account…",
      description: "Browser sign-in or paste a token",
      accountId: "__add__",
    },
  ];

  const saved = accounts.filter((account) => account.source === "saved");
  if (saved.length > 0) {
    items.push({
      label: "$(trash) Remove a saved account…",
      description: "Delete a pasted login from secret storage",
      accountId: "__remove__",
    });
  }

  const pick = await vscode.window.showQuickPick(items, {
    title: "Switch Cursor account",
    placeHolder: "Choose which Cursor login to monitor",
  });
  if (!pick) {
    return false;
  }
  if (pick.accountId === "__add__") {
    return promptAddCursorAccount(context);
  }
  if (pick.accountId === "__remove__") {
    return promptRemoveCursorAccount(context);
  }
  await setActiveAccountId(context, pick.accountId);
  return true;
}

export async function promptRemoveCursorAccount(
  context: vscode.ExtensionContext,
  accountId?: string
): Promise<boolean> {
  const accounts = (await listPublicAccounts(context)).filter((account) => account.source === "saved");
  if (accounts.length === 0) {
    NotificationProvider.show({
      title: "No saved accounts",
      message: "Only this Cursor session is connected. Add another login to switch between them.",
      type: "info",
      duration: 4000,
    });
    return false;
  }

  let id = accountId;
  if (!id || id === SYSTEM_ACCOUNT_ID) {
    const pick = await vscode.window.showQuickPick(
      accounts.map((account) => ({
        label: account.label,
        description: account.email ?? account.id,
        accountId: account.id,
      })),
      { title: "Remove saved Cursor account", placeHolder: "This does not sign you out of Cursor" }
    );
    if (!pick) {
      return false;
    }
    id = pick.accountId;
  }

  if (!id) {
    return false;
  }

  const target = accounts.find((account) => account.id === id);
  const confirm = await vscode.window.showWarningMessage(
    `Remove saved login${target?.email ? ` ${target.email}` : ""} from Cursor Curse Monitor?`,
    { modal: true },
    "Remove"
  );
  if (confirm !== "Remove") {
    return false;
  }
  await removeSavedAccount(context, id);
  return true;
}
