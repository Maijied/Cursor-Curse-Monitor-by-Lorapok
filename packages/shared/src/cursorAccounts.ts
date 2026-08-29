export const SYSTEM_ACCOUNT_ID = "system";

export interface CursorAccountPublic {
  id: string;
  email: string | null;
  label: string;
  source: "system" | "saved";
}

export interface StoredCursorAccount {
  id: string;
  email: string | null;
  label?: string;
  token: string;
}

export function createAccountId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return `acc_${cryptoObj.randomUUID()}`;
  }
  return `acc_${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const raw = token.replace(/^Bearer\s+/i, "").trim();
  const parts = raw.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    let json: string;
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(padded, "base64").toString("utf8");
    } else {
      const atobFn = (globalThis as { atob?: (data: string) => string }).atob;
      if (typeof atobFn !== "function") {
        return null;
      }
      json = decodeURIComponent(
        Array.from(atobFn(padded), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")
      );
    }
    const payload = JSON.parse(json) as Record<string, unknown>;
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

/** Extract the JWT from a WorkosCursorSessionToken dashboard cookie (`userId::jwt`). */
export function jwtFromWorkosCursorSessionCookie(cookieValue: string): string | null {
  if (!cookieValue) {
    return null;
  }
  const decoded = decodeURIComponent(cookieValue.trim());
  const sep = decoded.indexOf("::");
  if (sep >= 0) {
    const token = decoded.slice(sep + 2).trim();
    return token.length >= 20 ? token : null;
  }
  const raw = decoded.replace(/^Bearer\s+/i, "").trim();
  return raw.startsWith("eyJ") && raw.length >= 20 ? raw : null;
}

/** Best-effort email from a JWT-shaped Cursor token. Never throws; never logs the token. */
export function emailFromCursorToken(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return null;
  }
  for (const key of ["email", "preferred_username", "upn"]) {
    const value = payload[key];
    if (typeof value === "string" && value.includes("@")) {
      return value.trim();
    }
  }
  if (typeof payload.sub === "string" && payload.sub.includes("@")) {
    return payload.sub.trim();
  }
  return null;
}

export function accountDisplayLabel(
  account: { email: string | null; label?: string; source?: "system" | "saved" },
  fallback = "Saved account"
): string {
  if (account.label && account.label.trim()) {
    return account.label.trim();
  }
  if (account.email) {
    return account.source === "system" ? `${account.email} (this session)` : account.email;
  }
  return account.source === "system" ? "This Cursor session" : fallback;
}

export function toPublicAccount(account: StoredCursorAccount): CursorAccountPublic {
  return {
    id: account.id,
    email: account.email,
    label: accountDisplayLabel({ ...account, source: "saved" }),
    source: "saved",
  };
}

export function upsertSavedAccount(
  accounts: StoredCursorAccount[],
  token: string,
  email?: string | null,
  label?: string
): { accounts: StoredCursorAccount[]; id: string } {
  const trimmed = token.replace(/^Bearer\s+/i, "").trim();
  const resolvedEmail =
    (email && email.includes("@") ? email.trim() : null) ?? emailFromCursorToken(trimmed);
  const existing = accounts.find((account) => account.token === trimmed);
  if (existing) {
    return {
      id: existing.id,
      accounts: accounts.map((account) =>
        account.id === existing.id
          ? {
              ...account,
              email: resolvedEmail ?? account.email,
              label: label?.trim() || account.label,
            }
          : account
      ),
    };
  }
  const id = createAccountId();
  return {
    id,
    accounts: [
      ...accounts,
      {
        id,
        token: trimmed,
        email: resolvedEmail,
        label: label?.trim() || undefined,
      },
    ],
  };
}

/**
 * One-shot migration from a single accessToken/email pair.
 * An existing `accounts` array (even empty) is treated as the new schema.
 */
export function migrateLegacyToken(
  accounts: StoredCursorAccount[] | undefined,
  accessToken: string | null | undefined,
  email: string | null | undefined
): { accounts: StoredCursorAccount[]; activeAccountId: string | null; migrated: boolean } {
  if (Array.isArray(accounts)) {
    const cleaned = accounts.filter(
      (account) =>
        account &&
        typeof account.id === "string" &&
        typeof account.token === "string" &&
        account.token.length > 0
    );
    return {
      accounts: cleaned,
      activeAccountId: cleaned[0]?.id ?? null,
      migrated: false,
    };
  }
  if (typeof accessToken === "string" && accessToken.trim()) {
    const token = accessToken.replace(/^Bearer\s+/i, "").trim();
    const id = createAccountId();
    return {
      accounts: [
        {
          id,
          token,
          email: (email && email.includes("@") ? email.trim() : null) ?? emailFromCursorToken(token),
        },
      ],
      activeAccountId: id,
      migrated: true,
    };
  }
  return { accounts: [], activeAccountId: null, migrated: false };
}

export function resolveSavedAuth(
  accounts: StoredCursorAccount[],
  activeAccountId: string | null | undefined
): StoredCursorAccount | null {
  if (!accounts.length) {
    return null;
  }
  return accounts.find((account) => account.id === activeAccountId) ?? accounts[0];
}
