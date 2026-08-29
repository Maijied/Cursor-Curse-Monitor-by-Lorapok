import * as vscode from "vscode";

export type StatusBarUsageSource = "plan" | "autoApi" | "both";

export type EditorSettings = {
  pollIntervalSeconds: number;
  customBudgetLimit: number;
  autoApplyFallbackModel: boolean;
  showStatusBar: boolean;
  statusBarUsageSource: StatusBarUsageSource;
  warnAtPercent: number;
  anonymousUsageStats: boolean;
  productNotices: boolean;
  securityScanEnabled: boolean;
  scanOnSave: boolean;
  blockSaveOnSecret: boolean;
};

const CONFIG_SECTION = "cursorCurseMonitor";
const POLL_MIN_SECONDS = 15;
const POLL_MAX_SECONDS = 3600;

function clampPollIntervalSeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return 30;
  }
  return Math.min(POLL_MAX_SECONDS, Math.max(POLL_MIN_SECONDS, Math.round(value)));
}

function clampWarnAtPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 80;
  }
  return Math.min(100, Math.max(1, Math.round(value)));
}

function clampBudgetLimit(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

export function readEditorSettings(): EditorSettings {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    pollIntervalSeconds: config.get<number>("pollIntervalSeconds", 30),
    customBudgetLimit: config.get<number>("customBudgetLimit", 0),
    autoApplyFallbackModel: config.get<boolean>("autoApplyFallbackModel", true),
    showStatusBar: config.get<boolean>("showStatusBar", true),
    statusBarUsageSource: config.get<StatusBarUsageSource>("statusBarUsageSource", "autoApi"),
    warnAtPercent: config.get<number>("warnAtPercent", 80),
    anonymousUsageStats: config.get<boolean>("anonymousUsageStats", true),
    productNotices: config.get<boolean>("productNotices", true),
    securityScanEnabled: config.get<boolean>("securityScanEnabled", true),
    scanOnSave: config.get<boolean>("scanOnSave", true),
    blockSaveOnSecret: config.get<boolean>("blockSaveOnSecret", false),
  };
}

export async function updateEditorSettings(
  partial: Partial<EditorSettings>
): Promise<EditorSettings> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const normalized: Partial<EditorSettings> = { ...partial };
  if (normalized.pollIntervalSeconds !== undefined) {
    normalized.pollIntervalSeconds = clampPollIntervalSeconds(normalized.pollIntervalSeconds);
  }
  if (normalized.warnAtPercent !== undefined) {
    normalized.warnAtPercent = clampWarnAtPercent(normalized.warnAtPercent);
  }
  if (normalized.customBudgetLimit !== undefined) {
    normalized.customBudgetLimit = clampBudgetLimit(normalized.customBudgetLimit);
  }
  const entries = Object.entries(normalized) as Array<
    [keyof EditorSettings, EditorSettings[keyof EditorSettings]]
  >;
  for (const [key, value] of entries) {
    if (value === undefined) {
      continue;
    }
    await config.update(key, value, vscode.ConfigurationTarget.Global);
  }
  return readEditorSettings();
}

export function serializeEditorSettings(settings: EditorSettings): string {
  return JSON.stringify(settings)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
