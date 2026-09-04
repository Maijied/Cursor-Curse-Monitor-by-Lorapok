import type {
  BudgetMetrics,
  DailyCodeStats,
  LocalInsights,
  UsageHistoryPoint,
  UsageSummary,
} from "./cursorApi";

export type UsageRangePreset = "7d" | "30d" | "cycle" | "mtd";
export type UsageGroupBy = "autoApi" | "surface" | "model";

export interface UsageKpiSummary {
  totalLabel: string;
  totalValue: string;
  includedLabel: string;
  includedValue: string;
  onDemandLabel: string;
  onDemandValue: string;
}

export interface UsageChartLayer {
  id: string;
  label: string;
  color: string;
  values: number[];
}

export interface UsageChartPoint {
  t: number;
  label: string;
}

export interface UsageAnalyticsView {
  range: UsageRangePreset;
  groupBy: UsageGroupBy;
  kpi: UsageKpiSummary;
  points: UsageChartPoint[];
  layers: UsageChartLayer[];
  yMax: number;
  yUnit: "percent" | "lines" | "units";
  emptyMessage?: string;
}

export const USAGE_LAYER_COLORS = {
  auto: "#39ff14",
  api: "#4d9fff",
  tab: "#7c5cff",
  composer: "#4d9fff",
  default: "#f5b942",
  bugbot: "#ff6bcb",
} as const;

const MODEL_PALETTE = [
  "#39ff14",
  "#4d9fff",
  "#f5b942",
  "#ff6bcb",
  "#a78bfa",
  "#22d3ee",
  "#fb923c",
];

function modelColor(modelId: string, index: number): string {
  let hash = 0;
  for (let i = 0; i < modelId.length; i++) {
    hash = (hash * 31 + modelId.charCodeAt(i)) | 0;
  }
  return MODEL_PALETTE[Math.abs(hash) % MODEL_PALETTE.length] ?? MODEL_PALETTE[index % MODEL_PALETTE.length]!;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n || 0);
}

function formatUnits(n: number): string {
  return `${Math.round(n).toLocaleString()} u`;
}

function rangeStartMs(range: UsageRangePreset, cycleStart?: string): number {
  const now = Date.now();
  if (range === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (range === "30d") return now - 30 * 24 * 60 * 60 * 1000;
  if (range === "mtd") {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  if (cycleStart) {
    const parsed = Date.parse(cycleStart);
    if (Number.isFinite(parsed)) return parsed;
  }
  return now - 30 * 24 * 60 * 60 * 1000;
}

function filterHistoryByRange(
  history: UsageHistoryPoint[],
  range: UsageRangePreset,
  cycleStart?: string
): UsageHistoryPoint[] {
  const start = rangeStartMs(range, cycleStart);
  return history.filter((p) => p.t >= start).sort((a, b) => a.t - b.t);
}

function pointLabel(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dayKeyFromStats(stats: DailyCodeStats): string | null {
  const raw = stats.date?.trim();
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function filterDailyByRange(
  daily: DailyCodeStats[],
  range: UsageRangePreset,
  cycleStart?: string
): DailyCodeStats[] {
  const start = rangeStartMs(range, cycleStart);
  return daily
    .filter((row) => {
      const key = dayKeyFromStats(row);
      if (!key) return true;
      const ms = Date.parse(`${key}T12:00:00`);
      return Number.isFinite(ms) ? ms >= start : true;
    })
    .sort((a, b) => (dayKeyFromStats(a) ?? "").localeCompare(dayKeyFromStats(b) ?? ""));
}

function maxStackTotal(layers: Array<{ values: number[] }>, floor = 1): number {
  if (!layers.length) return floor;
  const pointCount = layers[0]!.values.length;
  let max = floor;
  for (let i = 0; i < pointCount; i++) {
    let sum = 0;
    for (const layer of layers) {
      sum += layer.values[i] ?? 0;
    }
    max = Math.max(max, sum);
  }
  return max;
}

export function buildUsageKpi(
  budget: BudgetMetrics | null | undefined,
  usage: UsageSummary | null | undefined,
  onDemandSpendUsd: number
): UsageKpiSummary {
  if (!budget) {
    return {
      totalLabel: "Total usage",
      totalValue: "—",
      includedLabel: "Included",
      includedValue: "—",
      onDemandLabel: "On-demand",
      onDemandValue: "—",
    };
  }

  const heroPct = Math.round(
    budget.usdBudgetActive ? budget.budgetPercentUsed : budget.percentUsed
  );

  return {
    totalLabel: budget.usdBudgetActive ? "Spend" : "Pool used",
    totalValue: budget.usdBudgetActive
      ? formatUsd(budget.spentUsd)
      : `${heroPct}%`,
    includedLabel: "Included",
    includedValue: `${formatUnits(budget.includedUsed)} / ${formatUnits(budget.includedLimit)}`,
    onDemandLabel: "On-demand",
    onDemandValue: budget.onDemandEnabled || onDemandSpendUsd > 0
      ? formatUsd(onDemandSpendUsd)
      : formatUsd(0),
  };
}

export interface BuildUsageAnalyticsInput {
  budget: BudgetMetrics | null | undefined;
  usage: UsageSummary | null | undefined;
  history?: UsageHistoryPoint[];
  local?: LocalInsights | null;
  dailySeries?: DailyCodeStats[];
  onDemandSpendUsd?: number;
  range?: UsageRangePreset;
  groupBy?: UsageGroupBy;
}

export function buildUsageAnalytics(input: BuildUsageAnalyticsInput): UsageAnalyticsView | null {
  const range = input.range ?? "7d";
  const groupBy = input.groupBy ?? "autoApi";
  const cycleStart = input.usage?.billingCycleStart;
  const kpi = buildUsageKpi(input.budget, input.usage, input.onDemandSpendUsd ?? 0);

  if (groupBy === "surface") {
    if (!input.dailySeries?.length) {
      return {
        range,
        groupBy,
        kpi,
        points: [],
        layers: [],
        yMax: 1,
        yUnit: "lines",
        emptyMessage: "Local daily stats are not available yet — keep using Cursor on this machine.",
      };
    }
    const rows = filterDailyByRange(input.dailySeries, range, cycleStart);
    if (rows.length < 2) {
      return {
        range,
        groupBy,
        kpi,
        points: [],
        layers: [],
        yMax: 1,
        yUnit: "lines",
        emptyMessage: "Need more local daily stats — keep using Cursor on this machine.",
      };
    }
    const points: UsageChartPoint[] = rows.map((row) => {
      const key = dayKeyFromStats(row) ?? row.date;
      const ms = Date.parse(`${key}T12:00:00`);
      return { t: Number.isFinite(ms) ? ms : Date.now(), label: key };
    });
    const tabValues = rows.map((r) => r.tabAcceptedLines);
    const composerValues = rows.map((r) => r.composerAcceptedLines);
    const surfaceLayers = [
      { id: "tab", label: "Tab", color: USAGE_LAYER_COLORS.tab, values: tabValues },
      { id: "composer", label: "Composer", color: USAGE_LAYER_COLORS.composer, values: composerValues },
    ];
    return {
      range,
      groupBy,
      kpi,
      points,
      layers: surfaceLayers,
      yMax: maxStackTotal(surfaceLayers),
      yUnit: "lines",
    };
  }

  if (groupBy === "model") {
    if (!input.local?.models?.length) {
      return {
        range,
        groupBy,
        kpi,
        points: [],
        layers: [],
        yMax: 100,
        yUnit: "percent",
        emptyMessage: "Model breakdown needs local dashboard capture — try again after using Cursor.",
      };
    }
    const models = input.local.models;
    const history = filterHistoryByRange(input.history ?? [], range, cycleStart);
    if (history.length < 2) {
      return {
        range,
        groupBy,
        kpi,
        points: [],
        layers: [],
        yMax: 100,
        yUnit: "percent",
        emptyMessage: "Model usage over time needs dashboard capture — showing Auto/API for now.",
      };
    }
    const points: UsageChartPoint[] = history.map((p) => ({ t: p.t, label: pointLabel(p.t) }));
    const share = 100 / Math.max(models.length, 1);
    const layers: UsageChartLayer[] = models.slice(0, 6).map((m, i) => ({
      id: m.modelName,
      label: m.modelName,
      color: modelColor(m.modelName, i),
      values: history.map((p) => {
        const base = (p.auto + p.api) / 2;
        return (base * share) / 100;
      }),
    }));
    return {
      range,
      groupBy,
      kpi,
      points,
      layers,
      yMax: 100,
      yUnit: "percent",
      emptyMessage: "Estimated split from Auto/API until token API is captured.",
    };
  }

  const history = filterHistoryByRange(input.history ?? [], range, cycleStart);
  if (history.length < 2) {
    return {
      range,
      groupBy: "autoApi",
      kpi,
      points: [],
      layers: [],
      yMax: 100,
      yUnit: "percent",
      emptyMessage: "Trend builds as usage is polled.",
    };
  }

  const points: UsageChartPoint[] = history.map((p) => ({ t: p.t, label: pointLabel(p.t) }));
  const autoValues = history.map((p) => p.auto);
  const apiValues = history.map((p) => p.api);
  const autoApiLayers = [
    { id: "auto", label: "Auto", color: USAGE_LAYER_COLORS.auto, values: autoValues },
    { id: "api", label: "API", color: USAGE_LAYER_COLORS.api, values: apiValues },
  ];

  return {
    range,
    groupBy: "autoApi",
    kpi,
    points,
    layers: autoApiLayers,
    yMax: Math.max(100, maxStackTotal(autoApiLayers)),
    yUnit: "percent",
  };
}
