/** Compact token/unit formatter (662.3M, 120.6K). */
export function formatCompactCount(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export interface StackedAreaLayerInput {
  id: string;
  label: string;
  color: string;
  values: number[];
}

export interface StackedAreaPath {
  id: string;
  label: string;
  color: string;
  areaD: string;
  lineD: string;
}

export interface StackedAreaGeometry {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
  yMax: number;
  paths: StackedAreaPath[];
  tops: Array<{ x: number; y: number; total: number }>;
}

/** Build stacked area SVG paths (bottom layer first). */
export function buildStackedAreaGeometry(
  layers: StackedAreaLayerInput[],
  pointCount: number,
  options?: { width?: number; height?: number; paddingX?: number; paddingY?: number; yMax?: number }
): StackedAreaGeometry | null {
  if (!layers.length || pointCount < 2) return null;

  const width = options?.width ?? 360;
  const height = options?.height ?? 140;
  const paddingX = options?.paddingX ?? 8;
  const paddingY = options?.paddingY ?? 12;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const totals = Array.from({ length: pointCount }, (_, i) =>
    layers.reduce((sum, layer) => sum + (layer.values[i] ?? 0), 0)
  );
  const maxTotal = Math.max(...totals, 1);
  const yMax = options?.yMax ?? maxTotal;

  const xAt = (i: number) => paddingX + (i / (pointCount - 1)) * chartW;
  const yAt = (v: number) => paddingY + chartH - (Math.max(0, v) / yMax) * chartH;

  const paths: StackedAreaPath[] = [];
  const cumulative: number[] = Array(pointCount).fill(0);

  for (const layer of layers) {
    const topY: number[] = [];
    const bottomY: number[] = [];
    for (let i = 0; i < pointCount; i++) {
      const bottom = cumulative[i] ?? 0;
      const top = bottom + (layer.values[i] ?? 0);
      cumulative[i] = top;
      bottomY.push(yAt(bottom));
      topY.push(yAt(top));
    }

    let lineD = `M ${xAt(0).toFixed(1)} ${topY[0]!.toFixed(1)}`;
    for (let i = 1; i < pointCount; i++) {
      const x0 = xAt(i - 1);
      const x1 = xAt(i);
      const mx = (x0 + x1) / 2;
      lineD += ` C ${mx.toFixed(1)} ${topY[i - 1]!.toFixed(1)}, ${mx.toFixed(1)} ${topY[i]!.toFixed(1)}, ${x1.toFixed(1)} ${topY[i]!.toFixed(1)}`;
    }

    let areaD = lineD;
    for (let i = pointCount - 1; i >= 0; i--) {
      areaD += ` L ${xAt(i).toFixed(1)} ${bottomY[i]!.toFixed(1)}`;
    }
    areaD += " Z";

    paths.push({ id: layer.id, label: layer.label, color: layer.color, areaD, lineD });
  }

  const tops = totals.map((total, i) => ({ x: xAt(i), y: yAt(total), total }));

  return { width, height, paddingX, paddingY, yMax, paths, tops };
}
