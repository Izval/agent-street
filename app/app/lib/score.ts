/**
 * Score color scale (DESIGN.md §6): ≥70 green (up) · 40–69 brand · <40 red (down).
 * Generic 0–100 reputation/quality score — used by ScoreMeter, cards and rows.
 * Returns the semantic token name (use with var(--…) or Tailwind classes).
 */
export function scoreTone(score: number): "up" | "brand" | "down" {
  if (score >= 70) return "up";
  if (score >= 40) return "brand";
  return "down";
}
