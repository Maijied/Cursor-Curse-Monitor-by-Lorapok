import * as vscode from "vscode";
import {
  applyComposerFallbackModel,
  readCachedAccountEmail,
  readCursorAccessToken,
} from "./cursorAuth";
import {
  DashboardSnapshot,
  fetchStripeProfile,
  fetchUsageSummary,
  isLimitExceeded,
} from "./cursorApi";

type SnapshotListener = (snapshot: DashboardSnapshot) => void;

export class UsageMonitorService implements vscode.Disposable {
  private timer: NodeJS.Timeout | undefined;
  private lastSnapshot: DashboardSnapshot | undefined;
  private warnedAtThreshold = false;
  private fallbackAppliedThisCycle = false;
  private readonly listeners = new Set<SnapshotListener>();
  private readonly wasmPath: string;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.wasmPath = vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "sql-wasm.wasm"
    ).fsPath;
  }

  onDidUpdate(listener: SnapshotListener): vscode.Disposable {
    this.listeners.add(listener);
    if (this.lastSnapshot) {
      listener(this.lastSnapshot);
    }
    return new vscode.Disposable(() => this.listeners.delete(listener));
  }

  getSnapshot(): DashboardSnapshot | undefined {
    return this.lastSnapshot;
  }

  start(): void {
    void this.refresh();
    this.schedule();
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("cursorCurseMonitor.pollIntervalSeconds")) {
          this.schedule();
        }
      })
    );
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.listeners.clear();
  }

  async refresh(): Promise<DashboardSnapshot> {
    const config = vscode.workspace.getConfiguration("cursorCurseMonitor");
    const customBudgetLimit = config.get<number>("customBudgetLimit", 0);
    const autoApplyFallback = config.get<boolean>("autoApplyFallbackModel", true);
    const warnAtPercent = config.get<number>("warnAtPercent", 80);

    const snapshot: DashboardSnapshot = {
      fetchedAt: new Date().toISOString(),
      email: null,
      usage: null,
      profile: null,
      fallbackApplied: false,
      limitExceeded: false,
      customBudgetLimit,
      onDemandSpendUsd: 0,
    };

    try {
      const token = await readCursorAccessToken(this.wasmPath);
      if (!token) {
        throw new Error(
          "Cursor auth token not found. Sign in to Cursor and reload the window."
        );
      }

      snapshot.email = await readCachedAccountEmail(this.wasmPath);
      snapshot.usage = await fetchUsageSummary(token);
      snapshot.profile = await fetchStripeProfile(token);
      snapshot.onDemandSpendUsd =
        (snapshot.usage.individualUsage.onDemand.used ?? 0) / 100;
      snapshot.limitExceeded = isLimitExceeded(snapshot.usage);

      const percent = snapshot.usage.individualUsage.plan.totalPercentUsed;
      if (percent >= warnAtPercent && !this.warnedAtThreshold && percent < 100) {
        this.warnedAtThreshold = true;
        void vscode.window.showWarningMessage(
          `Cursor usage is at ${percent}%. Consider switching to Composer 2.5 (Fast off) before you hit the limit.`
        );
      }
      if (percent < warnAtPercent) {
        this.warnedAtThreshold = false;
      }

      if (snapshot.limitExceeded && autoApplyFallback) {
        const applied = await applyComposerFallbackModel(this.wasmPath);
        snapshot.fallbackApplied = applied;
        if (applied && !this.fallbackAppliedThisCycle) {
          this.fallbackAppliedThisCycle = true;
          void vscode.window.showInformationMessage(
            "Usage limit reached. Switched agent model to Composer 2.5 (Fast off) for free fallback."
          );
        }
      } else if (!snapshot.limitExceeded) {
        this.fallbackAppliedThisCycle = false;
      }
    } catch (error) {
      snapshot.error =
        error instanceof Error ? error.message : "Unknown refresh error";
    }

    this.lastSnapshot = snapshot;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
    return snapshot;
  }

  private schedule(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    const seconds = vscode.workspace
      .getConfiguration("cursorCurseMonitor")
      .get<number>("pollIntervalSeconds", 60);
    this.timer = setInterval(() => {
      void this.refresh();
    }, seconds * 1000);
  }
}
