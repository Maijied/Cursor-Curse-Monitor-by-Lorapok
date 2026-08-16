import * as vscode from "vscode";
import {
  applyComposerFallbackModel,
  cursorDbExists,
  detectEditorHost,
  readCachedAccountEmail,
  readCursorAccessToken,
} from "./cursorAuth";
import {
  buildBudgetMetrics,
  buildFeatureList,
  DashboardSnapshot,
  fetchStripeProfile,
  fetchUsageSummary,
  isLimitExceeded,
} from "./cursorApi";
import { NotificationProvider } from "./notificationProvider";

type SnapshotListener = (snapshot: DashboardSnapshot) => void;

export class UsageMonitorService implements vscode.Disposable {
  private timer: NodeJS.Timeout | undefined;
  private lastSnapshot: DashboardSnapshot | undefined;
  private refreshInFlight: Promise<DashboardSnapshot> | null = null;
  private warnedAtThreshold = false;
  private fallbackAppliedThisCycle = false;
  private readonly listeners = new Set<SnapshotListener>();

  constructor(private readonly context: vscode.ExtensionContext) {}

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
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    this.refreshInFlight = this.doRefresh();
    try {
      return await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }
  }

  private async doRefresh(): Promise<DashboardSnapshot> {
    const config = vscode.workspace.getConfiguration("cursorCurseMonitor");
    const customBudgetLimit = config.get<number>("customBudgetLimit", 0);
    const autoApplyFallback = config.get<boolean>("autoApplyFallbackModel", false);
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
      budget: null,
      features: [],
      host: detectEditorHost(vscode.env.appName),
      cursorMissing: !cursorDbExists(),
    };

    if (snapshot.cursorMissing) {
      snapshot.error =
        "Cursor storage database not found. Install or open Cursor, sign in, then refresh. Monitoring stays read-only until the database exists.";
      this.lastSnapshot = snapshot;
      for (const listener of this.listeners) {
        listener(snapshot);
      }
      return snapshot;
    }

    try {
      const token = await readCursorAccessToken();
      if (!token) {
        throw new Error(
          "Cursor auth token not found. Sign in to Cursor and reload the window."
        );
      }

      snapshot.email = await readCachedAccountEmail();
      snapshot.usage = await fetchUsageSummary(token);
      snapshot.profile = await fetchStripeProfile(token);
      snapshot.onDemandSpendUsd =
        (snapshot.usage.individualUsage.onDemand.used ?? 0) / 100;
      snapshot.limitExceeded = isLimitExceeded(snapshot.usage);
      snapshot.budget = buildBudgetMetrics(
        snapshot.usage,
        customBudgetLimit,
        snapshot.onDemandSpendUsd,
        warnAtPercent,
        snapshot.limitExceeded
      );
      snapshot.features = buildFeatureList(snapshot.usage, snapshot.profile);

      const percent = snapshot.budget?.hasUsdBudget
        ? snapshot.budget.budgetPercentUsed ?? snapshot.budget.percentUsed
        : snapshot.usage.individualUsage.plan.totalPercentUsed;
      if (percent >= warnAtPercent && !this.warnedAtThreshold && percent < 100) {
        this.warnedAtThreshold = true;
        const budgetMsg = snapshot.budget?.hasUsdBudget
          ? `Budget usage is at ${Math.round(percent)}% ($${snapshot.budget?.spentUsd?.toFixed(2) ?? "0"} / $${snapshot.budget?.capUsd?.toFixed(2) ?? "0"}).`
          : `Cursor usage is at ${Math.round(percent)}%.`;
        NotificationProvider.show({
          title: "Usage Warning",
          message: `${budgetMsg} Consider switching to Composer 2.5 (Fast off) before you hit the limit.`,
          type: "warning",
          duration: 6000,
          actions: [
            {
              label: "Apply Fallback",
              action: () => {
                void vscode.commands.executeCommand("cursorCurseMonitor.applyFallbackModel");
              },
            },
            { label: "Dismiss", action: () => {} },
          ],
        });
      }
      if (percent < warnAtPercent) {
        this.warnedAtThreshold = false;
      }

      if (snapshot.limitExceeded && autoApplyFallback) {
        const result = await applyComposerFallbackModel();
        snapshot.fallbackApplied = result.success;
        if (result.success && !this.fallbackAppliedThisCycle) {
          this.fallbackAppliedThisCycle = true;
          
          if (!result.alreadySet) {
            NotificationProvider.show({
              title: "Fallback Applied",
              message: "Usage limit reached. Switched agent model to Composer 2.5 (Fast off) for free fallback.",
              type: "success",
              duration: 10000,
              actions: [
                { label: "Reload Window (Apply)", action: () => void vscode.commands.executeCommand("workbench.action.reloadWindow") },
                { label: "Dismiss", action: () => {} },
              ],
            });
          }
        } else if (!result.success && result.error) {
          // Show error to user but continue monitoring
          NotificationProvider.show({
            title: "Fallback Failed",
            message: `Failed to apply fallback model: ${result.error}. Extension will continue monitoring usage.`,
            type: "error",
            duration: 7000,
            actions: [
              { label: "Retry", action: () => void vscode.commands.executeCommand("cursorCurseMonitor.applyFallbackModel") },
              { label: "Dismiss", action: () => {} },
            ],
          });
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
