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
