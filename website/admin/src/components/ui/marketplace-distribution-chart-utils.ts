/** Build cumulative stroke-dash segments for a multi-slice donut (SVG circles, -90° rotation). */
export function buildDonutStrokeSlices(
  channels: Array<{ id: string; count: number }>,
  total: number,
  circumference: number,
) {
  const safeTotal = total > 0 ? total : 1;
  let cumulative = 0;

  return channels
    .filter((channel) => channel.count > 0)
    .map((channel) => {
      const length = (channel.count / safeTotal) * circumference;
      const dashOffset = -cumulative;
      cumulative += length;
      return {
        id: channel.id,
        length,
        dashOffset,
        pct: channel.count / safeTotal,
      };
    });
}
