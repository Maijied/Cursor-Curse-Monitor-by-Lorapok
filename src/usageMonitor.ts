import * as vscode from "vscode";
import {
  applyComposerFallbackModel,
  cursorDbExists,
  detectEditorHost,
  discoverCursorAuthInstalls,
  getMonitoringProductFolder,
  monitoringDbExists,
} from "./cursorAuth";
import {
  appendUsageHistory,
  buildBudgetMetrics,
  buildFeatureList,
  DashboardSnapshot,
  fetchStripeProfile,
  fetchUsageSummary,
  isLimitExceeded,
  UsageHistoryPoint,
} from "./cursorApi";
import { emptyLocalInsights, readLocalInsights } from "./cursorLocalStore";
import { NotificationProvider } from "./notificationProvider";
import { listPublicAccounts, resolveActiveAuth } from "./accountStore";

const USAGE_HISTORY_KEY = "usageHistoryV1";
const REFRESH_COOLDOWN_MS = 1500;

type SnapshotListener = (snapshot: DashboardSnapshot) => void;

export class UsageMonitorService implements vscode.Disposable {
  private timer: NodeJS.Timeout | undefined;
  private lastSnapshot: DashboardSnapshot | undefined;
  private refreshInFlight: Promise<DashboardSnapshot> | null = null;
  private lastRefreshTime = 0;
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

  async refresh(force = false): Promise<DashboardSnapshot> {
    const now = Date.now();
    if (!force && this.lastSnapshot && now - this.lastRefreshTime < REFRESH_COOLDOWN_MS) {
      return this.lastSnapshot;
    }
    if (this.refreshInFlight) {
      if (!force) {
        return this.refreshInFlight;
      }
      // Forced refresh: wait for current refresh to complete, then serialize the forced replacement
      try {
        await this.refreshInFlight;
      } catch {
        // Prior refresh failed; still run a fresh forced refresh below.
      }
      // After awaiting, check if another forced caller already started a new refresh
      if (this.refreshInFlight) {
        return this.refreshInFlight;
      }
    }
    const promise = this.doRefresh();
    this.refreshInFlight = promise;
    try {
      const result = await promise;
      this.lastRefreshTime = Date.now();
      return result;
    } finally {
      // Only clear refreshInFlight if this promise still owns it
      if (this.refreshInFlight === promise) {
        this.refreshInFlight = null;
      }
    }
  }

  private async doRefresh(): Promise<DashboardSnapshot> {
    const config = vscode.workspace.getConfiguration("cursorCurseMonitor");
    const customBudgetLimit = config.get<number>("customBudgetLimit", 0);
    const autoApplyFallback = config.get<boolean>("autoApplyFallbackModel", true);
    const warnAtPercent = config.get<number>("warnAtPercent", 80);

    const auth = await resolveActiveAuth(this.context);
    const accounts = await listPublicAccounts(this.context);
    const discoveredLogins = discoverCursorAuthInstalls();
    const dbMissing = !monitoringDbExists() && !auth.token;
    const editorAppName = vscode.env.appName;

    const snapshot: DashboardSnapshot = {
      fetchedAt: new Date().toISOString(),
      email: auth.email,
      usage: null,
      profile: null,
      fallbackApplied: false,
      limitExceeded: false,
      customBudgetLimit,
      onDemandSpendUsd: 0,
      budget: null,
      features: [],
      host: detectEditorHost(editorAppName),
      cursorMissing: !auth.token,
      local: emptyLocalInsights(),
      history: this.loadHistory(),
      accounts,
      activeAccountId: auth.id,
      monitoringProduct: auth.productFolder ?? getMonitoringProductFolder(),
      discoveredLoginCount: discoveredLogins.length,
      editorAppName,
    };

    if (!dbMissing) {
      try {
        snapshot.local = readLocalInsights(auth.productFolder);
      } catch {
        snapshot.local = emptyLocalInsights();
      }
    }

    if (!auth.token) {
      const loginHint =
        discoveredLogins.length > 1
          ? `${discoveredLogins.length} Cursor logins were found on this computer — pick one in the account switcher, or sign in below.`
          : dbMissing
            ? "Connect to Cursor first: sign in at cursor.com/dashboard, paste an access token, or open Cursor on this machine."
            : "Cursor is not signed in. Sign in at cursor.com/dashboard, reload the window, or paste an access token.";
      snapshot.error = loginHint;
      this.publish(snapshot);
      return snapshot;
    }

    try {
      snapshot.usage = await fetchUsageSummary(auth.token);
      snapshot.profile = await fetchStripeProfile(auth.token);
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
      snapshot.history = this.recordHistory(snapshot);

      const percent = snapshot.budget.percentUsed;
      if (percent >= warnAtPercent && !this.warnedAtThreshold && percent < 100) {
        this.warnedAtThreshold = true;
        const budgetMsg = snapshot.budget.usdBudgetActive
          ? `Budget usage is at ${Math.round(snapshot.budget.budgetPercentUsed)}% ($${snapshot.budget.spentUsd.toFixed(2)} / $${snapshot.budget.capUsd.toFixed(2)}).`
          : `Cursor usage is at ${Math.round(percent)}%.`;
        NotificationProvider.show({
          title: "Usage Warning",
          message:
            auth.source === "system"
              ? `${budgetMsg} Consider switching to Composer 2.5 (Fast off) before you hit the limit.`
              : `${budgetMsg} This is a saved Cursor login — Composer fallback still applies only to this editor session.`,
          type: "warning",
          actions:
            auth.source === "system"
              ? [
                  {
                    label: "Apply Fallback",
                    action: () => {
                      void vscode.commands.executeCommand("cursorCurseMonitor.applyFallbackModel");
                    },
                  },
                ]
              : [],
        });
      }
      if (percent < warnAtPercent) {
        this.warnedAtThreshold = false;
      }

      if (snapshot.limitExceeded && autoApplyFallback && auth.source === "system") {
        const result = await applyComposerFallbackModel();
        snapshot.fallbackApplied = result.success;
        if (result.success && !this.fallbackAppliedThisCycle) {
          this.fallbackAppliedThisCycle = true;

          if (!result.alreadySet) {
            NotificationProvider.show({
              title: "Fallback Applied",
              message: "Usage limit reached. Switched agent model to Composer 2.5 (Fast off) for free fallback.",
              type: "success",
              actions: [
                {
                  label: "Reload Window (Apply)",
                  action: () => void vscode.commands.executeCommand("workbench.action.reloadWindow"),
                },
              ],
            });
          }
        } else if (!result.success && result.error) {
          NotificationProvider.show({
            title: "Fallback Failed",
            message: `Failed to apply fallback model: ${result.error}. Extension will continue monitoring usage.`,
            type: "error",
            actions: [
              {
                label: "Retry",
                action: () => void vscode.commands.executeCommand("cursorCurseMonitor.applyFallbackModel"),
              },
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

    this.publish(snapshot);
    return snapshot;
  }

  private loadHistory(): UsageHistoryPoint[] {
    const stored = this.context.globalState.get<UsageHistoryPoint[]>(USAGE_HISTORY_KEY, []);
    return Array.isArray(stored) ? stored : [];
  }

  private recordHistory(snapshot: DashboardSnapshot): UsageHistoryPoint[] {
    const budget = snapshot.budget;
    if (!budget) {
      return this.loadHistory();
    }
    const next: UsageHistoryPoint = {
      t: Date.now(),
      includedPercent: budget.usdBudgetActive
        ? budget.budgetPercentUsed
        : budget.percentUsed,
      auto: budget.autoPercentUsed,
      api: budget.apiPercentUsed,
      spentUsd: budget.spentUsd,
    };
    const merged = appendUsageHistory(this.loadHistory(), next);
    void this.context.globalState.update(USAGE_HISTORY_KEY, merged);
    return merged;
  }

  private publish(snapshot: DashboardSnapshot): void {
    this.lastSnapshot = snapshot;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private schedule(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    const rawSeconds = vscode.workspace
      .getConfiguration("cursorCurseMonitor")
      .get<number>("pollIntervalSeconds", 30);
    const seconds = Math.min(3600, Math.max(15, Number(rawSeconds) || 30));
    this.timer = setInterval(() => {
      void this.refresh();
    }, seconds * 1000);
  }
}
