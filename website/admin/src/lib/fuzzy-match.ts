/**
 * Lightweight fuzzy scorer for Mission Control command palette.
 * Returns 0 when no match; higher is better.
 */
export function fuzzyScore(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 1;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 + Math.min(q.length, 50);
  if (t.includes(q)) return 500 + Math.min(q.length, 40);

  let ti = 0;
  let score = 0;
  let streak = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    const found = t.indexOf(ch, ti);
    if (found === -1) return 0;
    if (found === ti) {
      streak += 1;
      score += 12 + streak;
    } else {
      streak = 0;
      score += 4;
    }
    ti = found + 1;
  }
  return score;
}

/** Best score across several haystacks. */
export function fuzzyBest(query: string, fields: string[]): number {
  let best = 0;
  for (const field of fields) {
    const s = fuzzyScore(query, field);
    if (s > best) best = s;
  }
  return best;
}
