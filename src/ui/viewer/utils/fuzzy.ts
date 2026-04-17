/**
 * Tiny fzf-style fuzzy matcher, no dependency.
 * Returns null if pattern does not match, otherwise a score (higher = better).
 */
export function fuzzyMatch(pattern: string, text: string): number | null {
  if (!pattern) return 0;
  const p = pattern.toLowerCase();
  const t = text.toLowerCase();
  let pi = 0;
  let ti = 0;
  let score = 0;
  let lastMatchIdx = -1;
  let consecutive = 0;
  while (pi < p.length && ti < t.length) {
    if (p[pi] === t[ti]) {
      // bonus if at word boundary
      const isBoundary = ti === 0 || /[\s\-_./]/.test(t[ti - 1]);
      let step = 10;
      if (isBoundary) step += 6;
      if (lastMatchIdx === ti - 1) {
        consecutive++;
        step += 4 + consecutive * 2;
      } else {
        consecutive = 0;
      }
      score += step;
      lastMatchIdx = ti;
      pi++;
    } else {
      score -= 1;
    }
    ti++;
  }
  if (pi < p.length) return null;
  // Penalty for remaining chars — prefer compact matches.
  score -= (t.length - lastMatchIdx) * 0.5;
  return score;
}
