import type { CursorAccountPublic } from "./cursorAccounts";

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
  /** Units consumed from the included (non-bonus) pool. */
  includedPoolUsed: number;
  /** Units remaining in the included (non-bonus) pool. */
  includedPoolRemaining: number;
  bonusUsed: number;
  bonusRemaining: number;
  bonusLabel: string;
  /** True when Cursor reports 100% but the combined pool still has headroom. */
  staleLimitBanner: boolean;
  staleLimitMessage: string;
  teamOnDemandEnabled: boolean;
  teamOnDemandSpendUsd: number | null;
}

import type { UsageAnalyticsView } from "./usageAnalytics";

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
  /** Public account list for the switcher. Tokens are never included. */
  accounts?: CursorAccountPublic[];
  activeAccountId?: string;
  /** Folder name under ~/.config (or OS app-data) used for the primary session DB. */
  monitoringProduct?: string;
  /** Cursor-compatible installs on this machine with a signed-in token. */
  discoveredLoginCount?: number;
  /** vscode.env.appName from the host editor. */
  editorAppName?: string;
  /** Derived chart/KPI view for usage analytics (range + group-by). */
  usageAnalytics?: UsageAnalyticsView | null;
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

export function validateUsageSummary(data: unknown): UsageSummary {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid API response: payload is not an object");
  }

  const obj = data as Record<string, unknown>;
  const individualUsage = obj.individualUsage as Record<string, unknown> | undefined;

  if (!individualUsage || typeof individualUsage !== "object") {
    throw new Error("Invalid API response: missing 'individualUsage' field");
  }

  const plan = individualUsage.plan as Record<string, unknown> | undefined;
  if (!plan || typeof plan !== "object") {
    throw new Error("Invalid API response: missing 'individualUsage.plan' field");
  }

  const onDemand = individualUsage.onDemand as Record<string, unknown> | undefined;
  if (!onDemand || typeof onDemand !== "object") {
    throw new Error("Invalid API response: missing 'individualUsage.onDemand' field");
  }

  const safeNumber = (val: unknown, fallback = 0): number =>
    typeof val === "number" && Number.isFinite(val) ? val : fallback;
  const safeString = (val: unknown, fallback = ""): string =>
    typeof val === "string" ? val : fallback;
  const safeBool = (val: unknown, fallback = false): boolean =>
    typeof val === "boolean" ? val : fallback;

  const validatedPlan: UsagePlan = {
    enabled: safeBool(plan.enabled, true),
    used: safeNumber(plan.used, 0),
    limit: safeNumber(plan.limit, 0),
    remaining: safeNumber(plan.remaining, 0),
    autoPercentUsed: safeNumber(plan.autoPercentUsed, 0),
    apiPercentUsed: safeNumber(plan.apiPercentUsed, 0),
    totalPercentUsed: safeNumber(plan.totalPercentUsed, 0),
  };

  if (plan.breakdown && typeof plan.breakdown === "object") {
    const b = plan.breakdown as Record<string, unknown>;
    validatedPlan.breakdown = {
      included: safeNumber(b.included, 0),
      bonus: safeNumber(b.bonus, 0),
      total: safeNumber(b.total, 0),
    };
  }

  const validatedOnDemand: OnDemandUsage = {
    enabled: safeBool(onDemand.enabled, false),
    used: safeNumber(onDemand.used, 0),
    limit: typeof onDemand.limit === "number" && Number.isFinite(onDemand.limit) ? onDemand.limit : null,
    remaining: typeof onDemand.remaining === "number" && Number.isFinite(onDemand.remaining) ? onDemand.remaining : null,
  };

  const summary: UsageSummary = {
    billingCycleStart: safeString(obj.billingCycleStart, new Date().toISOString()),
    billingCycleEnd: safeString(obj.billingCycleEnd, new Date().toISOString()),
    membershipType: safeString(obj.membershipType, "Pro"),
    limitType: safeString(obj.limitType, "Monthly"),
    isUnlimited: safeBool(obj.isUnlimited, false),
    individualUsage: {
      plan: validatedPlan,
      onDemand: validatedOnDemand,
    },
  };

  if (typeof obj.autoModelSelectedDisplayMessage === "string") {
    summary.autoModelSelectedDisplayMessage = obj.autoModelSelectedDisplayMessage;
  }
  if (typeof obj.namedModelSelectedDisplayMessage === "string") {
    summary.namedModelSelectedDisplayMessage = obj.namedModelSelectedDisplayMessage;
  }

  if (obj.teamUsage && typeof obj.teamUsage === "object") {
    const teamObj = obj.teamUsage as Record<string, unknown>;
    if (teamObj.onDemand && typeof teamObj.onDemand === "object") {
      const teamOnDemand = teamObj.onDemand as Record<string, unknown>;
      summary.teamUsage = {
        onDemand: {
          enabled: safeBool(teamOnDemand.enabled, false),
          used: safeNumber(teamOnDemand.used, 0),
          limit: typeof teamOnDemand.limit === "number" && Number.isFinite(teamOnDemand.limit) ? teamOnDemand.limit : null,
          remaining: typeof teamOnDemand.remaining === "number" && Number.isFinite(teamOnDemand.remaining) ? teamOnDemand.remaining : null,
        },
      };
    }
  }

  return summary;
}

export function validateStripeProfile(data: unknown): StripeProfile {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid Profile API response: payload is not an object");
  }

  const obj = data as Record<string, unknown>;
  const safeString = (val: unknown, fallback = ""): string =>
    typeof val === "string" ? val : fallback;
  const safeBool = (val: unknown, fallback = false): boolean =>
    typeof val === "boolean" ? val : fallback;

  const profile: StripeProfile = {
    membershipType: safeString(obj.membershipType, "Pro"),
    isTeamMember: safeBool(obj.isTeamMember, false),
  };

  if (typeof obj.teamId === "number") {
    profile.teamId = obj.teamId;
  }
  if (typeof obj.teamMembershipType === "string") {
    profile.teamMembershipType = obj.teamMembershipType;
  }
  if (typeof obj.individualMembershipType === "string") {
    profile.individualMembershipType = obj.individualMembershipType;
  }
  if (typeof obj.isOnBillableAuto === "boolean") {
    profile.isOnBillableAuto = obj.isOnBillableAuto;
  }
  if (typeof obj.isYearlyPlan === "boolean") {
    profile.isYearlyPlan = obj.isYearlyPlan;
  }

  return profile;
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
    if (response.status === 401) {
      throw new Error("Usage API failed (401)");
    }
    throw new Error(`Usage API failed (${response.status})`);
  }

  const json = await response.json();
  return validateUsageSummary(json);
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

  const json = await response.json();
  return validateStripeProfile(json);
}

export function isLimitExceeded(usage: UsageSummary): boolean {
  const plan = usage.individualUsage.plan;
  const pool = resolveUsagePlanPool(plan);
  if (plan.enabled && pool.remaining <= 0 && pool.total > 0) {
    return true;
  }
  if (plan.enabled && plan.totalPercentUsed >= 100 && pool.remaining <= 0) {
    return true;
  }

  const autoMsg = (usage.autoModelSelectedDisplayMessage ?? "").toLowerCase();
  const apiMsg = (usage.namedModelSelectedDisplayMessage ?? "").toLowerCase();
  if (pool.remaining <= 0) {
    return autoMsg.includes("100%") || apiMsg.includes("100%");
  }
  return false;
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
  if (!Number.isFinite(end)) {
    return 0;
  }
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

/** Normalize included + bonus pools from Cursor usage-summary (API limit is often included-only). */
export function resolveUsagePlanPool(plan: UsagePlan): {
  included: number;
  bonus: number;
  total: number;
  used: number;
  remaining: number;
  percentUsed: number;
} {
  const breakdown = plan.breakdown;
  const included = breakdown?.included ?? plan.limit;
  const bonus = breakdown?.bonus ?? 0;
  const total =
    breakdown?.total ?? (included + bonus > 0 ? included + bonus : plan.limit);
  const used = plan.used;
  const remaining =
    total > 0 ? Math.max(0, total - used) : Math.max(0, plan.remaining);
  const percentUsed =
    total > 0
      ? Math.min(100, (used / total) * 100)
      : Math.min(100, plan.totalPercentUsed || 0);
  return { included, bonus, total, used, remaining, percentUsed };
}

/** Detect when Cursor's totalPercentUsed or model messages say 100% but bonus/included headroom remains. */
export function detectStaleLimitBanner(
  usage: UsageSummary,
  pool: ReturnType<typeof resolveUsagePlanPool>
): { staleLimitBanner: boolean; staleLimitMessage: string } {
  if (pool.remaining <= 0 || pool.total <= 0) {
    return { staleLimitBanner: false, staleLimitMessage: "" };
  }

  const plan = usage.individualUsage.plan;
  const autoMsg = (usage.autoModelSelectedDisplayMessage ?? "").toLowerCase();
  const apiMsg = (usage.namedModelSelectedDisplayMessage ?? "").toLowerCase();
  const apiSays100 =
    plan.totalPercentUsed >= 100 ||
    autoMsg.includes("100%") ||
    apiMsg.includes("100%");

  if (!apiSays100) {
    return { staleLimitBanner: false, staleLimitMessage: "" };
  }

  const creditLabel = pool.bonus > 0 ? "agent credits" : "units";
  const message =
    `Cursor may show 100% even though your pool is not exhausted. ` +
    `${pool.remaining.toLocaleString()} ${creditLabel} still available.`;

  return { staleLimitBanner: true, staleLimitMessage: message };
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
  const pool = resolveUsagePlanPool(plan);
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

  const exhaustedAll = pool.remaining <= 0 && pool.total > 0;
  const includedPercent = exhaustedAll
    ? Math.max(100, plan.totalPercentUsed || pool.percentUsed)
    : pool.percentUsed;
  const percentUsed = exhaustedAll
    ? Math.max(
        includedPercent,
        plan.autoPercentUsed || 0,
        plan.apiPercentUsed || 0
      )
    : Math.max(
        pool.percentUsed,
        plan.autoPercentUsed || 0,
        plan.apiPercentUsed || 0
      );

  const includedPoolUsed = Math.min(pool.used, pool.included);
  const includedPoolRemaining = Math.max(0, pool.included - includedPoolUsed);
  const bonusUsed = Math.max(0, pool.used - pool.included);
  const bonusRemaining = Math.max(0, pool.bonus - bonusUsed);
  const bonusLabel = pool.bonus > 0 ? "Agent credits" : "";
  const stale = detectStaleLimitBanner(usage, pool);

  const thresholdReached =
    percentUsed >= thresholdPercent ||
    (usdBudgetActive && budgetPercentUsed >= thresholdPercent);

  const teamOnDemand = usage.teamUsage?.onDemand;

  return {
    percentUsed,
    includedPercent,
    includedUsed: pool.used,
    includedLimit: pool.total,
    includedRemaining: pool.remaining,
    includedPoolUsed,
    includedPoolRemaining,
    bonusUsed,
    bonusRemaining,
    bonusLabel,
    staleLimitBanner: stale.staleLimitBanner,
    staleLimitMessage: stale.staleLimitMessage,
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
    planBreakdownIncluded: pool.included,
    planBreakdownBonus: pool.bonus,
    planBreakdownTotal: pool.total,
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
