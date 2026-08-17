import * as vscode from "vscode";
import * as crypto from "crypto";
import * as os from "os";

const INSTALL_ID_KEY = "anonymousInstallId";
const LAST_PING_DAY_KEY = "anonymousUsageLastPingDay";
const DEFAULT_PING_URL = "https://cursor-dev.lorapok.tech/api/usage/ping";

export function getOrCreateInstallId(context: vscode.ExtensionContext): string {
  const existing = context.globalState.get<string>(INSTALL_ID_KEY);
  if (existing && typeof existing === "string" && existing.length >= 8) {
    return existing;
  }
  const installId = crypto.randomUUID();
  void context.globalState.update(INSTALL_ID_KEY, installId);
  return installId;
}

function hostKind(): "cursor" | "vscode" {
  const name = (vscode.env.appName || "").toLowerCase();
  if (name.includes("cursor")) {
    return "cursor";
  }
  return "vscode";
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Opt-in anonymous heartbeat. Off by default.
 * Payload never includes paths, tokens, emails, or workspace names.
 * installId is created once and never regenerated (offline VSIX uniqueness).
 */
export async function maybeSendAnonymousHeartbeat(
  context: vscode.ExtensionContext,
  extensionVersion: string
): Promise<{ sent: boolean; reason?: string }> {
  const config = vscode.workspace.getConfiguration("cursorCurseMonitor");
  if (!config.get<boolean>("anonymousUsageStats", false)) {
    return { sent: false, reason: "disabled" };
  }

  const day = utcDay();
  const lastDay = context.globalState.get<string>(LAST_PING_DAY_KEY);
  if (lastDay === day) {
    return { sent: false, reason: "already-pinged-today" };
  }

  const installId = getOrCreateInstallId(context);
  const pingUrl =
    config.get<string>("anonymousUsagePingUrl")?.trim() || DEFAULT_PING_URL;

  const body = {
    installId,
    os: process.platform,
    host: hostKind(),
    version: extensionVersion,
  };

  try {
    const res = await fetch(pingUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { sent: false, reason: `http-${res.status}` };
    }
    await context.globalState.update(LAST_PING_DAY_KEY, day);
    return { sent: true };
  } catch {
    return { sent: false, reason: "network-error" };
  }
}

/** Exposed for tests — does not touch network. */
export function buildHeartbeatPayload(
  installId: string,
  version: string,
  platform = process.platform,
  host: "cursor" | "vscode" = "cursor"
): Record<string, string> {
  return {
    installId,
    os: platform,
    host,
    version,
  };
}

export function detectOsLabel(): string {
  return `${os.platform()}-${os.arch()}`;
}
