import React, { useEffect, useId, useMemo, useState } from "react";
import {
  buildStackedAreaGeometry,
  formatCompactCount,
  type UsageAnalyticsView,
  type UsageGroupBy,
  type UsageRangePreset,
} from "@lorapok/cursor-monitor-shared";

interface UsageAnalyticsChartProps {
  analytics: UsageAnalyticsView | null | undefined;
  onRangeChange?: (range: UsageRangePreset) => void;
  onGroupByChange?: (groupBy: UsageGroupBy) => void;
}

const RANGES: UsageRangePreset[] = ["7d", "30d", "cycle", "mtd"];
const GROUPS: { id: UsageGroupBy; label: string }[] = [
  { id: "autoApi", label: "Auto / API" },
  { id: "surface", label: "Tab / Composer" },
  { id: "model", label: "Model" },
];

export function UsageAnalyticsChart({
  analytics,
  onRangeChange,
  onGroupByChange,
}: UsageAnalyticsChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(false);
    const t = window.setTimeout(() => setAnimated(true), 30);
    return () => window.clearTimeout(t);
  }, [analytics?.range, analytics?.groupBy, analytics?.points.length]);

  const geometry = useMemo(() => {
    if (!analytics?.points.length || !analytics.layers.length) return null;
    return buildStackedAreaGeometry(analytics.layers, analytics.points.length, {
      width: 360,
      height: 120,
      yMax: analytics.yMax,
    });
  }, [analytics]);

  if (!analytics) return null;

  const empty = !geometry || analytics.points.length < 2;

  return (
    <section className="card usage-analytics-card">
      <div className="usage-analytics-head">
        <p className="section-label" style={{ margin: 0 }}>
          Your usage
        </p>
        <div className="usage-range-chips" role="tablist" aria-label="Date range">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              role="tab"
              aria-selected={analytics.range === range}
              className={`usage-chip${analytics.range === range ? " active" : ""}`}
              onClick={() => onRangeChange?.(range)}
            >
              {range === "mtd" ? "MTD" : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="usage-kpi-row">
        <div className="usage-kpi">
          <span className="usage-kpi-k">{analytics.kpi.totalLabel}</span>
          <strong className="usage-kpi-v">{analytics.kpi.totalValue}</strong>
        </div>
        <div className="usage-kpi">
          <span className="usage-kpi-k">{analytics.kpi.includedLabel}</span>
          <strong className="usage-kpi-v">{analytics.kpi.includedValue}</strong>
        </div>
        <div className="usage-kpi">
          <span className="usage-kpi-k">{analytics.kpi.onDemandLabel}</span>
          <strong className="usage-kpi-v">{analytics.kpi.onDemandValue}</strong>
        </div>
      </div>

      <div className="usage-controls">
        <label className="usage-group-label" htmlFor="usage-group-by">
          Group by
        </label>
        <select
          id="usage-group-by"
          className="usage-group-select"
          value={analytics.groupBy}
          onChange={(e) => onGroupByChange?.(e.target.value as UsageGroupBy)}
        >
          {GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      {empty ? (
        <p className="chart-empty muted">{analytics.emptyMessage ?? "Trend builds as usage is polled."}</p>
      ) : (
        <>
          <div className="usage-chart-wrap">
            <svg
              className="usage-stacked-chart"
              viewBox={`0 0 ${geometry!.width} ${geometry!.height}`}
              preserveAspectRatio="none"
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                {geometry!.paths.map((path) => (
                  <linearGradient
                    key={`${gradientId}-${path.id}`}
                    id={`${gradientId}-${path.id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={path.color} stopOpacity="0.45" />
                    <stop offset="100%" stopColor={path.color} stopOpacity="0.05" />
                  </linearGradient>
                ))}
              </defs>
              {geometry!.paths.map((path, layerIdx) => (
                <path
                  key={path.id}
                  d={path.areaD}
                  fill={`url(#${gradientId}-${path.id})`}
                  stroke={path.color}
                  strokeWidth="1"
                  style={{
                    opacity: animated ? 1 : 0,
                    transition: `opacity 0.6s ease ${layerIdx * 0.08}s`,
                  }}
                />
              ))}
              {hoverIndex !== null && geometry!.tops[hoverIndex] ? (
                <line
                  x1={geometry!.tops[hoverIndex]!.x}
                  y1={geometry!.paddingY}
                  x2={geometry!.tops[hoverIndex]!.x}
                  y2={geometry!.height - geometry!.paddingY}
                  stroke="rgba(255,255,255,0.25)"
                  strokeDasharray="3 3"
                />
              ) : null}
              {geometry!.tops.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoverIndex === i ? 4 : 0}
                  fill="#fff"
                  stroke="#7c5cff"
                  strokeWidth="2"
                  style={{ pointerEvents: "none" }}
                />
              ))}
              {geometry!.tops.map((pt, i) => (
                <rect
                  key={`hit-${i}`}
                  x={pt.x - 12}
                  y={geometry!.paddingY}
                  width={24}
                  height={geometry!.height - geometry!.paddingY * 2}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(i)}
                />
              ))}
            </svg>
            {hoverIndex !== null && analytics.points[hoverIndex] ? (
              <div className="usage-chart-tooltip" role="status">
                <strong>{analytics.points[hoverIndex]!.label}</strong>
                {analytics.layers.map((layer) => (
                  <div key={layer.id} className="usage-tooltip-row">
                    <span style={{ color: layer.color }}>{layer.label}</span>
                    <span>
                      {analytics.yUnit === "percent"
                        ? `${Math.round(layer.values[hoverIndex] ?? 0)}%`
                        : formatCompactCount(layer.values[hoverIndex] ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="usage-legend">
            {analytics.layers.map((layer) => (
              <span key={layer.id} className="usage-legend-item">
                <span className="usage-legend-dot" style={{ background: layer.color }} />
                {layer.label}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
