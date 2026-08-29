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

export function readEditorSettings(): EditorSettings {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    pollIntervalSeconds: config.get<number>("pollIntervalSeconds", 60),
    customBudgetLimit: config.get<number>("customBudgetLimit", 0),
    autoApplyFallbackModel: config.get<boolean>("autoApplyFallbackModel", false),
    showStatusBar: config.get<boolean>("showStatusBar", true),
    statusBarUsageSource: config.get<StatusBarUsageSource>("statusBarUsageSource", "autoApi"),
    warnAtPercent: config.get<number>("warnAtPercent", 80),
    anonymousUsageStats: config.get<boolean>("anonymousUsageStats", false),
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
  const entries = Object.entries(partial) as Array<[keyof EditorSettings, EditorSettings[keyof EditorSettings]]>;
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
