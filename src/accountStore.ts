import {
  SYSTEM_ACCOUNT_ID,
  accountDisplayLabel,
  discoveredAccountId,
  parseDiscoveredAccountId,
  toPublicAccount,
  upsertSavedAccount,
  type CursorAccountPublic,
  type StoredCursorAccount,
} from "@lorapok/cursor-monitor-shared";
import * as vscode from "vscode";
import {
  discoverCursorAuthInstalls,
  getMonitoringProductFolder,
  getProductStoragePaths,
  readAuthFromProduct,
  readCachedAccountEmail,
  readCursorAccessToken,
} from "./cursorAuth";

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

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || null;
}

export async function listPublicAccounts(context: vscode.ExtensionContext): Promise<CursorAccountPublic[]> {
  const monitoringProduct = getMonitoringProductFolder();
  const systemEmail = await readCachedAccountEmail();
  const systemEmailNorm = normalizeEmail(systemEmail);

  const discovered = discoverCursorAuthInstalls()
    .filter((install) => install.productFolder !== monitoringProduct)
    .map((install): CursorAccountPublic => ({
      id: discoveredAccountId(install.productFolder),
      email: install.email,
      label: accountDisplayLabel({
        email: install.email,
        source: "discovered",
        productFolder: install.productFolder,
      }),
      source: "discovered",
      productFolder: install.productFolder,
    }));

  const discoveredEmails = new Set(
    discovered.map((account) => normalizeEmail(account.email)).filter((email): email is string => !!email)
  );
  if (systemEmailNorm) {
    discoveredEmails.add(systemEmailNorm);
  }

  const saved = (await readPayload(context)).accounts
    .map(toPublicAccount)
    .filter((account) => {
      const emailNorm = normalizeEmail(account.email);
      if (!emailNorm) {
        return true;
      }
      return !discoveredEmails.has(emailNorm);
    });

  const system: CursorAccountPublic = {
    id: SYSTEM_ACCOUNT_ID,
    email: systemEmail,
    label: accountDisplayLabel({
      email: systemEmail,
      source: "system",
      productFolder: monitoringProduct,
    }),
    source: "system",
    productFolder: monitoringProduct,
  };

  return [system, ...discovered, ...saved];
}

export function getActiveAccountId(context: vscode.ExtensionContext): string {
  return context.globalState.get<string>(ACTIVE_KEY) || SYSTEM_ACCOUNT_ID;
}

async function isAllowedActiveAccount(context: vscode.ExtensionContext, id: string): Promise<boolean> {
  if (id === SYSTEM_ACCOUNT_ID) {
    return true;
  }
  const product = parseDiscoveredAccountId(id);
  if (product) {
    return discoverCursorAuthInstalls().some((install) => install.productFolder === product);
  }
  const payload = await readPayload(context);
  return payload.accounts.some((account) => account.id === id);
}

export async function setActiveAccountId(context: vscode.ExtensionContext, id: string): Promise<void> {
  const next = id || SYSTEM_ACCOUNT_ID;
  if (!(await isAllowedActiveAccount(context, next))) {
    await context.globalState.update(ACTIVE_KEY, SYSTEM_ACCOUNT_ID);
    return;
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
  if (!id || id === SYSTEM_ACCOUNT_ID || parseDiscoveredAccountId(id)) {
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
  source: "system" | "saved" | "discovered";
  productFolder?: string;
}

export async function resolveActiveAuth(context: vscode.ExtensionContext): Promise<ResolvedAuth> {
  const activeId = getActiveAccountId(context);
  if (activeId !== SYSTEM_ACCOUNT_ID) {
    const product = parseDiscoveredAccountId(activeId);
    if (product) {
      const install = discoverCursorAuthInstalls().find((entry) => entry.productFolder === product);
      if (install) {
        const auth = readAuthFromProduct(product);
        return {
          id: activeId,
          token: auth.token,
          email: auth.email,
          source: "discovered",
          productFolder: product,
        };
      }
      await setActiveAccountId(context, SYSTEM_ACCOUNT_ID);
    } else {
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
  }

  const monitoringProduct = getMonitoringProductFolder();
  return {
    id: SYSTEM_ACCOUNT_ID,
    token: await readCursorAccessToken(),
    email: await readCachedAccountEmail(),
    source: "system",
    productFolder: monitoringProduct,
  };
}

export type ActiveAccountStoragePaths = {
  accountId: string;
  accountLabel: string;
  productFolder: string;
  stateDbPath: string;
  searchDbPath: string;
  globalStorageDir: string;
};

export async function getActiveAccountStoragePaths(
  context: vscode.ExtensionContext
): Promise<{ ok: true; paths: ActiveAccountStoragePaths } | { ok: false; error: string }> {
  const auth = await resolveActiveAuth(context);
  if (!auth.productFolder) {
    return {
      ok: false,
      error:
        "This account has no local Cursor install on this machine. Switch to a system or discovered account before indexing.",
    };
  }
  const storage = getProductStoragePaths(auth.productFolder);
  const accounts = await listPublicAccounts(context);
  const account = accounts.find((entry) => entry.id === auth.id);
  return {
    ok: true,
    paths: {
      accountId: auth.id,
      accountLabel: account?.label ?? auth.email ?? auth.id,
      productFolder: auth.productFolder,
      stateDbPath: storage.stateDbPath,
      searchDbPath: storage.searchDbPath,
      globalStorageDir: storage.globalStorageDir,
    },
  };
}
