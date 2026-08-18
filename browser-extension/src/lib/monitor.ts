import {
  appendUsageHistory,
  buildBudgetMetrics,
  buildFeatureList,
  DashboardSnapshot,
  fetchStripeProfile,
  fetchUsageSummary,
  isLimitExceeded,
  UsageHistoryPoint,
} from "@lorapok/cursor-monitor-shared";
import {
  getHistory,
  getSettings,
  saveHistory,
  saveSnapshot,
} from "./storage";

export async function refreshSnapshot(): Promise<DashboardSnapshot> {
  const settings = await getSettings();
  const snapshot: DashboardSnapshot = {
    fetchedAt: new Date().toISOString(),
    email: settings.email,
    usage: null,
    profile: null,
    fallbackApplied: false,
    limitExceeded: false,
    customBudgetLimit: settings.customBudgetLimit,
    onDemandSpendUsd: 0,
    budget: null,
    features: [],
    history: await getHistory(),
  };

  if (!settings.accessToken) {
    snapshot.error =
      "Not connected. Open cursor.com/dashboard while signed in, or paste your token in Options.";
    await saveSnapshot(snapshot);
    return snapshot;
  }

  try {
    snapshot.usage = await fetchUsageSummary(settings.accessToken);
    snapshot.profile = await fetchStripeProfile(settings.accessToken);
    snapshot.onDemandSpendUsd =
      (snapshot.usage.individualUsage.onDemand.used ?? 0) / 100;
    snapshot.limitExceeded = isLimitExceeded(snapshot.usage);
    snapshot.budget = buildBudgetMetrics(
      snapshot.usage,
      settings.customBudgetLimit,
      snapshot.onDemandSpendUsd,
      settings.warnAtPercent,
      snapshot.limitExceeded
    );
    snapshot.features = buildFeatureList(snapshot.usage, snapshot.profile);
    snapshot.history = recordHistory(snapshot, await getHistory());
    await saveHistory(snapshot.history);
  } catch (error) {
    snapshot.error =
      error instanceof Error ? error.message : "Unknown refresh error";
  }

  await saveSnapshot(snapshot);
  return snapshot;
}

function recordHistory(
  snapshot: DashboardSnapshot,
  existing: UsageHistoryPoint[]
): UsageHistoryPoint[] {
  const budget = snapshot.budget;
  if (!budget) return existing;
  const next: UsageHistoryPoint = {
    t: Date.now(),
    includedPercent: budget.usdBudgetActive
      ? budget.budgetPercentUsed
      : budget.percentUsed,
    auto: budget.autoPercentUsed,
    api: budget.apiPercentUsed,
    spentUsd: budget.spentUsd,
  };
  return appendUsageHistory(existing, next);
}
