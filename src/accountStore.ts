import {
  SYSTEM_ACCOUNT_ID,
  accountDisplayLabel,
  toPublicAccount,
  upsertSavedAccount,
  type CursorAccountPublic,
  type StoredCursorAccount,
} from "@lorapok/cursor-monitor-shared";
import * as vscode from "vscode";
import { readCachedAccountEmail, readCursorAccessToken } from "./cursorAuth";

const SECRETS_KEY = "cursorAccounts.v1";
const ACTIVE_KEY = "activeAccountId";

interface SecretsPayload {
  accounts: StoredCursorAccount[];
}

async function readPayload(context: vscode.ExtensionContext): Promise<SecretsPayload> {
  try {
    const raw = await context.secrets?.get(SECRETS_KEY);
    if (!raw) {
      return { accounts: [] };
    }
    const parsed = JSON.parse(raw) as SecretsPayload;
    if (!Array.isArray(parsed.accounts)) {
      return { accounts: [] };
    }
    return {
      accounts: parsed.accounts.filter(
        (account) =>
          account &&
          typeof account.id === "string" &&
          typeof account.token === "string" &&
          account.token.length > 0
      ),
    };
  } catch {
    return { accounts: [] };
  }
}

async function writePayload(context: vscode.ExtensionContext, payload: SecretsPayload): Promise<void> {
  if (!context.secrets) {
    return;
  }
  await context.secrets.store(SECRETS_KEY, JSON.stringify(payload));
}

export async function listPublicAccounts(context: vscode.ExtensionContext): Promise<CursorAccountPublic[]> {
  const systemEmail = await readCachedAccountEmail();
  const saved = (await readPayload(context)).accounts.map(toPublicAccount);
  const system: CursorAccountPublic = {
    id: SYSTEM_ACCOUNT_ID,
    email: systemEmail,
    label: accountDisplayLabel({ email: systemEmail, source: "system" }),
    source: "system",
  };
  return [system, ...saved];
}

export function getActiveAccountId(context: vscode.ExtensionContext): string {
  return context.globalState.get<string>(ACTIVE_KEY) || SYSTEM_ACCOUNT_ID;
}

export async function setActiveAccountId(context: vscode.ExtensionContext, id: string): Promise<void> {
  const next = id || SYSTEM_ACCOUNT_ID;
  if (next !== SYSTEM_ACCOUNT_ID) {
    const saved = (await readPayload(context)).accounts.some((account) => account.id === next);
    if (!saved) {
      await context.globalState.update(ACTIVE_KEY, SYSTEM_ACCOUNT_ID);
      return;
    }
  }
  await context.globalState.update(ACTIVE_KEY, next);
}

export async function addSavedAccount(
  context: vscode.ExtensionContext,
  token: string,
  email?: string | null,
  label?: string
): Promise<{ id: string; email: string | null }> {
  const payload = await readPayload(context);
  const result = upsertSavedAccount(payload.accounts, token, email, label);
  await writePayload(context, { accounts: result.accounts });
  await setActiveAccountId(context, result.id);
  const added = result.accounts.find((account) => account.id === result.id);
  return { id: result.id, email: added?.email ?? null };
}

export async function removeSavedAccount(context: vscode.ExtensionContext, id: string): Promise<void> {
  if (!id || id === SYSTEM_ACCOUNT_ID) {
    return;
  }
  const payload = await readPayload(context);
  await writePayload(context, {
    accounts: payload.accounts.filter((account) => account.id !== id),
  });
  if (getActiveAccountId(context) === id) {
    await setActiveAccountId(context, SYSTEM_ACCOUNT_ID);
  }
}

export interface ResolvedAuth {
  id: string;
  token: string | null;
  email: string | null;
  source: "system" | "saved";
}

export async function resolveActiveAuth(context: vscode.ExtensionContext): Promise<ResolvedAuth> {
  const activeId = getActiveAccountId(context);
  if (activeId !== SYSTEM_ACCOUNT_ID) {
    const saved = (await readPayload(context)).accounts.find((account) => account.id === activeId);
    if (saved) {
      return {
        id: saved.id,
        token: saved.token,
        email: saved.email,
        source: "saved",
      };
    }
    await setActiveAccountId(context, SYSTEM_ACCOUNT_ID);
  }
  return {
    id: SYSTEM_ACCOUNT_ID,
    token: await readCursorAccessToken(),
    email: await readCachedAccountEmail(),
    source: "system",
  };
}
