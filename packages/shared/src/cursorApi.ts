export interface UsagePlan {
  enabled: boolean;
  used: number;
  limit: number;
  remaining: number;
  breakdown?: {
    included: number;
    bonus: number;
    total: number;
  };
  autoPercentUsed: number;
  apiPercentUsed: number;
  totalPercentUsed: number;
}

export interface OnDemandUsage {
  enabled: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface UsageSummary {
  billingCycleStart: string;
  billingCycleEnd: string;
  membershipType: string;
  limitType: string;
  isUnlimited: boolean;
  autoModelSelectedDisplayMessage?: string;
  namedModelSelectedDisplayMessage?: string;
  individualUsage: {
    plan: UsagePlan;
    onDemand: OnDemandUsage;
  };
  teamUsage?: {
    onDemand: OnDemandUsage;
  };
}

export interface StripeProfile {
  membershipType: string;
  isTeamMember: boolean;
  teamId?: number;
  teamMembershipType?: string;
  individualMembershipType?: string;
  isOnBillableAuto?: boolean;
  isYearlyPlan?: boolean;
}

export interface BudgetMetrics {
  /** Hero percent: included quota, Auto, or API — never an unused personal USD cap. */
  percentUsed: number;
  includedPercent: number;
  includedUsed: number;
  includedLimit: number;
  includedRemaining: number;
  autoPercentUsed: number;
  apiPercentUsed: number;
  capUsd: number;
  spentUsd: number;
  leftUsd: number;
  budgetPercentUsed: number;
  thresholdPercent: number;
  thresholdReached: boolean;
  limitExceeded: boolean;
  daysUntilReset: number;
  resetDateLabel: string;
  cycleStartLabel: string;
  cycleEndLabel: string;
  onDemandEnabled: boolean;
  onDemandCapUsd: number | null;
  onDemandRemainingUsd: number | null;
  /** True when a USD cap exists (custom or on-demand). */
  hasUsdBudget: boolean;
  /** True when USD spend should drive budget UI (on-demand on or spend > 0). */
  usdBudgetActive: boolean;
  planBreakdownIncluded: number;
  planBreakdownBonus: number;
  planBreakdownTotal: number;
  teamOnDemandEnabled: boolean;
  teamOnDemandSpendUsd: number | null;
}

export interface UsageHistoryPoint {
  t: number;
  includedPercent: number;
  auto: number;
  api: number;
  spentUsd: number;
}

export interface DashboardSnapshot {
  fetchedAt: string;
  email: string | null;
  usage: UsageSummary | null;
  profile: StripeProfile | null;
  error?: string;
  fallbackApplied: boolean;
  limitExceeded: boolean;
  customBudgetLimit: number;
  onDemandSpendUsd: number;
  budget: BudgetMetrics | null;
  features: string[];
  /** True when Cursor/VS Code state.vscdb is missing on disk. */
  cursorMissing?: boolean;
  host?: "cursor" | "vscode" | "unknown";
  local?: LocalInsights;
  history?: UsageHistoryPoint[];
}

export interface DailyCodeStats {
  date: string;
  tabSuggestedLines: number;
  tabAcceptedLines: number;
  composerSuggestedLines: number;
  composerAcceptedLines: number;
}

export interface ActiveModel {
  surface: string;
  label: string;
  modelName: string;
}

export interface RecentSession {
  id: string;
  name: string;
  mode: string;
  recency: number;
  recencyLabel: string;
  linesAdded: number;
  linesRemoved: number;
}

export interface LocalInsights {
  today: DailyCodeStats | null;
  cycleSuggested: number;
  cycleAccepted: number;
  tabAccepted: number;
  composerAccepted: number;
  models: ActiveModel[];
  lastUsedModel: string | null;
  sessions: RecentSession[];
  teamName: string | null;
  teamId: number | null;
  membershipType: string | null;
}

const API_BASE = "https://api2.cursor.sh/auth";

export async function fetchUsageSummary(token: string): Promise<UsageSummary> {
  const response = await fetch(`${API_BASE}/usage-summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Usage API failed (${response.status})`);
  }

  return (await response.json()) as UsageSummary;
}

export async function fetchStripeProfile(token: string): Promise<StripeProfile> {
  const response = await fetch(`${API_BASE}/full_stripe_profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Profile API failed (${response.status})`);
  }

  return (await response.json()) as StripeProfile;
}

export function isLimitExceeded(usage: UsageSummary): boolean {
  const plan = usage.individualUsage.plan;
  if (plan.enabled && plan.totalPercentUsed >= 100) {
    return true;
  }
  if (plan.enabled && plan.remaining <= 0 && plan.limit > 0) {
    return true;
  }

  const autoMsg = (usage.autoModelSelectedDisplayMessage ?? "").toLowerCase();
  const apiMsg = (usage.namedModelSelectedDisplayMessage ?? "").toLowerCase();
  return autoMsg.includes("100%") || apiMsg.includes("100%");
}

export function formatCycleDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function estimateDaysLeft(cycleEndIso: string): number {
  const end = new Date(cycleEndIso).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

export function formatPercent(n: number, digits = 1): string {
  if (!Number.isFinite(n)) {
    return "0";
  }
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

export const USAGE_HISTORY_MAX = 90;
export const USAGE_HISTORY_MIN_INTERVAL_MS = 8 * 60 * 60 * 1000;

export function appendUsageHistory(
  existing: UsageHistoryPoint[],
  next: UsageHistoryPoint
): UsageHistoryPoint[] {
  const last = existing[existing.length - 1];
  if (last) {
    const jumped =
      Math.abs(last.includedPercent - next.includedPercent) >= 2 ||
      Math.abs(last.auto - next.auto) >= 2 ||
      Math.abs(last.api - next.api) >= 2 ||
      Math.abs(last.spentUsd - next.spentUsd) >= 0.5;
    if (!jumped && next.t - last.t < USAGE_HISTORY_MIN_INTERVAL_MS) {
      return existing;
    }
  }
  return [...existing, next].slice(-USAGE_HISTORY_MAX);
}

export function buildBudgetMetrics(
  usage: UsageSummary,
  customBudgetLimit: number,
  onDemandSpendUsd: number,
  thresholdPercent: number,
  limitExceeded: boolean
): BudgetMetrics {
  const plan = usage.individualUsage.plan;
  const onDemand = usage.individualUsage.onDemand;
  const onDemandCapUsd =
    onDemand.limit != null && onDemand.limit > 0 ? onDemand.limit / 100 : null;
  const onDemandRemainingUsd =
    onDemand.remaining != null ? onDemand.remaining / 100 : null;

  const capUsd =
    customBudgetLimit > 0
      ? customBudgetLimit
      : onDemandCapUsd ?? 0;
  const hasUsdBudget = capUsd > 0;
  const usdBudgetActive = capUsd > 0 && (onDemand.enabled || onDemandSpendUsd > 0);
  const spentUsd = hasUsdBudget ? onDemandSpendUsd : 0;
  const leftUsd = hasUsdBudget ? Math.max(0, capUsd - spentUsd) : 0;
  const budgetPercentUsed = hasUsdBudget && capUsd > 0
    ? Math.min(100, (spentUsd / capUsd) * 100)
    : 0;

  const exhaustedIncluded = plan.remaining <= 0 && plan.limit > 0;
  const includedPercent = exhaustedIncluded
    ? Math.max(100, plan.totalPercentUsed || 0)
    : plan.totalPercentUsed;
  const percentUsed = Math.max(
    includedPercent,
    plan.autoPercentUsed || 0,
    plan.apiPercentUsed || 0
  );

  const breakdown = plan.breakdown;
  const thresholdReached =
    percentUsed >= thresholdPercent ||
    (usdBudgetActive && budgetPercentUsed >= thresholdPercent);

  const teamOnDemand = usage.teamUsage?.onDemand;

  return {
    percentUsed,
    includedPercent,
    includedUsed: plan.used,
    includedLimit: plan.limit,
    includedRemaining: plan.remaining,
    autoPercentUsed: plan.autoPercentUsed,
    apiPercentUsed: plan.apiPercentUsed,
    capUsd,
    spentUsd,
    leftUsd,
    budgetPercentUsed,
    thresholdPercent,
    thresholdReached,
    limitExceeded,
    daysUntilReset: estimateDaysLeft(usage.billingCycleEnd),
    resetDateLabel: formatCycleDate(usage.billingCycleEnd),
    cycleStartLabel: formatCycleDate(usage.billingCycleStart),
    cycleEndLabel: formatCycleDate(usage.billingCycleEnd),
    onDemandEnabled: onDemand.enabled,
    onDemandCapUsd,
    onDemandRemainingUsd,
    hasUsdBudget,
    usdBudgetActive,
    planBreakdownIncluded: breakdown?.included ?? plan.used,
    planBreakdownBonus: breakdown?.bonus ?? 0,
    planBreakdownTotal: breakdown?.total ?? plan.limit,
    teamOnDemandEnabled: Boolean(teamOnDemand?.enabled),
    teamOnDemandSpendUsd:
      teamOnDemand && teamOnDemand.used != null ? teamOnDemand.used / 100 : null,
  };
}

export function buildFeatureList(
  usage: UsageSummary,
  profile: StripeProfile | null
): string[] {
  const features: string[] = [];
  const plan = usage.individualUsage.plan;

  features.push(`${usage.membershipType || profile?.membershipType || "Plan"}`);
  if (profile?.isTeamMember) {
    features.push(`Team #${profile.teamId ?? "member"}`);
  }
  if (usage.isUnlimited) {
    features.push("Unlimited");
  }
  features.push(`Limit: ${usage.limitType}`);
  if (plan.breakdown) {
    features.push(`Included ${plan.breakdown.included} + bonus ${plan.breakdown.bonus}`);
  }
  features.push(`Auto ${formatPercent(plan.autoPercentUsed)}% · API ${formatPercent(plan.apiPercentUsed)}%`);
  if (usage.individualUsage.onDemand.enabled) {
    features.push("On-demand enabled");
  }
  if (profile?.isYearlyPlan) {
    features.push("Yearly billing");
  }
  if (profile?.isOnBillableAuto) {
    features.push("Billable auto");
  }
  return features;
}
