import React, { useEffect, useRef } from "react";
import type { UsageHistoryPoint } from "@lorapok/cursor-monitor-shared";

interface SpendChartProps {
  points: UsageHistoryPoint[];
  threshold: number;
}

export function SpendChart({ points, threshold }: SpendChartProps) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    requestAnimationFrame(() => {
      path.style.transition = "stroke-dashoffset 1s ease-out";
      path.style.strokeDashoffset = "0";
    });
  }, [points]);

  if (!points || points.length < 2) {
    return (
      <div className="chart-empty muted">Trend builds as usage is polled.</div>
    );
  }

  const w = 360;
  const h = 80;
  const pad = 8;
  const values = points.map((p) => p.includedPercent);
  const maxY = Math.max(100, ...values, threshold);
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - pad * 2));
  const ys = values.map((v) => pad + (1 - v / maxY) * (h - pad * 2));
  const d = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const threshY = pad + (1 - threshold / maxY) * (h - pad * 2);

  return (
    <div className="chart-wrap">
      <div className="chart-head">
        <span className="section-label">Spend over time</span>
        <span className="chart-legend">--- {threshold}% threshold</span>
      </div>
      <svg className="spend-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <line
          x1={pad}
          y1={threshY}
          x2={w - pad}
          y2={threshY}
          stroke="#F59E0B"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <path ref={pathRef} d={d} fill="none" stroke="#4d9fff" strokeWidth="2" />
      </svg>
    </div>
  );
}
