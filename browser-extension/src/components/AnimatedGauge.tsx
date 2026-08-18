import React, { useEffect, useState } from "react";

interface AnimatedGaugeProps {
  percent: number;
  spendLabel: string;
  spendValue: string;
  threshold: number;
  thresholdReached: boolean;
}

export function AnimatedGauge({
  percent,
  spendLabel,
  spendValue,
  threshold,
  thresholdReached,
}: AnimatedGaugeProps) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 800;
    const target = Math.max(0, Math.min(100, percent));
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [percent]);

  const angle = -90 + (animated / 100) * 180;
  const arcLen = (animated / 100) * 157;

  return (
    <div className="gauge-panel">
      <svg className="gauge-svg" viewBox="0 0 200 120" aria-hidden>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#252b38"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${arcLen} 200`}
        />
        {[0, 50, 80, 100].map((tick) => {
          const a = (-180 + (tick / 100) * 180) * (Math.PI / 180);
          const cx = 100 + 68 * Math.cos(a);
          const cy = 100 + 68 * Math.sin(a);
          return (
            <text
              key={tick}
              x={cx}
              y={cy}
              className={`gauge-tick ${tick === 80 ? "warn" : ""}`}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {tick}%
            </text>
          );
        })}
        <g transform={`rotate(${angle} 100 100)`}>
          <line x1="100" y1="100" x2="100" y2="32" stroke="#eef2fb" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="100" cy="100" r="6" fill="#4d9fff" />
        </g>
      </svg>
      <div className="gauge-center">
        <div className="gauge-label">{spendLabel}</div>
        <div className="gauge-value">{spendValue}</div>
        {thresholdReached && (
          <div className="gauge-pill warn">⚠ {Math.round(percent)}% of budget</div>
        )}
      </div>
    </div>
  );
}
