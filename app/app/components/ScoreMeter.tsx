/**
 * Score meter 0–100 (DESIGN.md §6): ≥70 green · 40–69 brand · <40 red.
 * Reuses scoreTone's exact cutoffs (lib/score.ts) — don't reinvent the scale.
 */

import { scoreTone } from "../lib/score";

const TONE_TEXT: Record<"up" | "brand" | "down", string> = {
  up: "text-up",
  brand: "text-brand",
  down: "text-down",
};
const TONE_BG: Record<"up" | "brand" | "down", string> = {
  up: "bg-up",
  brand: "bg-brand",
  down: "bg-down",
};

export function ScoreMeter({
  score,
  label,
  size = "md",
}: {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const tone = scoreTone(score);
  const pct = Math.max(0, Math.min(100, score));
  const num =
    size === "lg" ? "text-4xl" : size === "sm" ? "text-xl" : "text-2xl";
  return (
    <div>
      {label && <div className="text-xs text-text-3">{label}</div>}
      <div className={`tnum font-bold ${num} ${TONE_TEXT[tone]}`}>{score}</div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-[999px] bg-surface-2"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-[999px] ${TONE_BG[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
