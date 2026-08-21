import * as vscode from "vscode";
import { scanSecrets, type SecurityFinding } from "@lorapok/cursor-monitor-shared";
import { SecurityAlertPanel } from "./securityAlertPanel";
import { NotificationProvider } from "./notificationProvider";

const DEBOUNCE_MS = 2000;
const lastShown = new Map<string, number>();
const COOLDOWN_MS = 30_000;

function config() {
  return vscode.workspace.getConfiguration("cursorCurseMonitor");
}

function shouldScan(): boolean {
  return config().get<boolean>("securityScanEnabled", true);
}

function shouldBlockSave(): boolean {
  return config().get<boolean>("blockSaveOnSecret", false);
}

function shouldScanOnSave(): boolean {
  return config().get<boolean>("scanOnSave", true);
}

function isExcludedDoc(doc: vscode.TextDocument): boolean {
  const p = doc.uri.fsPath;
  if (doc.uri.scheme !== "file") return true;
  if (/node_modules|\.git|[\\/]tests[\\/]|dist\/|\.vsix|package-lock\.json/.test(p)) return true;
  if (/\.(md|svg|png|jpg|woff2?)$/i.test(p) && !/\.env/.test(p)) return true;
  return false;
}

function dedupeKey(f: SecurityFinding): string {
  return `${f.location}:${f.kind}:${f.line ?? 0}`;
}

function showFindings(context: vscode.ExtensionContext, findings: SecurityFinding[]): void {
  if (!findings.length) return;
  const key = findings.map(dedupeKey).join("|");
  const now = Date.now();
  if (lastShown.has(key) && now - (lastShown.get(key) ?? 0) < COOLDOWN_MS) return;
  lastShown.set(key, now);

  SecurityAlertPanel.show(context, findings);
  NotificationProvider.show({
    title: "Security Alert",
    message: `${findings.length} potential credential(s) detected. Review before committing or sharing.`,
    type: "error",
    actions: [{ label: "Review", action: () => SecurityAlertPanel.show(context, findings) }],
  });
}

export class SecurityMonitorService implements vscode.Disposable {
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  start(): void {
    if (!shouldScan()) return;

    this.disposables.push(
      vscode.workspace.onWillSaveTextDocument((event) => {
        if (!shouldScanOnSave() && !shouldBlockSave()) return;
        const doc = event.document;
        if (isExcludedDoc(doc)) return;
        const findings = scanSecrets(doc.getText(), {
          location: doc.uri.fsPath,
          context: "workspace",
        });
        if (!findings.length) return;
        showFindings(this.context, findings);
        if (shouldBlockSave()) {
          event.waitUntil(
            vscode.window
              .showErrorMessage(
                "Save blocked: potential credentials detected. Remove secrets or disable cursorCurseMonitor.blockSaveOnSecret.",
                "Open Settings"
              )
              .then((choice) => {
                if (choice === "Open Settings") {
                  void vscode.commands.executeCommand(
                    "workbench.action.openSettings",
                    "cursorCurseMonitor.blockSaveOnSecret"
                  );
                }
                return Promise.reject(
                  new Error("Save blocked: potential credentials detected.")
                );
              })
          );
        }
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        const doc = event.document;
        if (isExcludedDoc(doc)) return;
        const id = doc.uri.toString();
        const prev = this.debounceTimers.get(id);
        if (prev) clearTimeout(prev);
        this.debounceTimers.set(
          id,
          setTimeout(() => {
            const findings = scanSecrets(doc.getText(), {
              location: doc.uri.fsPath,
              context: "workspace",
            });
            if (findings.length) showFindings(this.context, findings);
          }, DEBOUNCE_MS)
        );
      })
    );
  }

  async scanWorkspace(): Promise<SecurityFinding[]> {
    const files = await vscode.workspace.findFiles(
      "**/*",
      "**/{node_modules,.git,dist}/**"
    );
    const all: SecurityFinding[] = [];
    for (const uri of files.slice(0, 500)) {
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        if (isExcludedDoc(doc)) continue;
        all.push(
          ...scanSecrets(doc.getText(), {
            location: doc.uri.fsPath,
            context: "workspace",
          })
        );
      } catch {
        /* skip */
      }
    }
    if (all.length) showFindings(this.context, all);
    else {
      NotificationProvider.show({
        message: "No credentials detected in workspace scan.",
        type: "info",
      });
    }
    return all;
  }

  async scanClipboard(): Promise<SecurityFinding[]> {
    const text = await vscode.env.clipboard.readText();
    const findings = scanSecrets(text, { location: "clipboard", context: "clipboard" });
    if (findings.length) showFindings(this.context, findings);
    else {
      NotificationProvider.show({ message: "Clipboard scan: no credentials detected.", type: "info" });
    }
    return findings;
  }

  dispose(): void {
    for (const t of this.debounceTimers.values()) clearTimeout(t);
    this.debounceTimers.clear();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}
