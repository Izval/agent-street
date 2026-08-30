/**
 * KpiTile — KPI tile for the detail dashboard (DESIGN.md v2 §17.2).
 * Large value with tabular numerals; signed delta and up/down color
 * (green/red ONLY for data, §2.3); `hint` in --text-3 ("since indexed").
 */

import type { ReactNode } from "react";

type Tone = "up" | "down" | "neutral";

const DELTA_TEXT: Record<Tone, string> = {
  up: "text-up",
  down: "text-down",
  neutral: "text-text-3",
};

const DELTA_SIGN: Record<Tone, string> = {
  up: "▲",
  down: "▼",
  neutral: "",
};

export function KpiTile({
  label,
  value,
  delta,
  tone = "neutral",
  hint,
  glass = false,
}: {
  label: string;
  value: ReactNode;
  /** Already-formatted change, e.g. "12.4%" or "+1.2". The sign/arrow comes from the tone. */
  delta?: string;
  tone?: Tone;
  /** Data provenance note, e.g. "since indexed". */
  hint?: string;
  glass?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg p-4 " +
        (glass ? "glass" : "border border-border bg-surface-2")
      }
    >
      <div className="text-xs font-medium text-text-3">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="tnum text-2xl font-bold leading-tight text-text">
          {value}
        </span>
        {delta && (
          <span
            className={`tnum text-sm font-semibold ${DELTA_TEXT[tone]}`}
          >
            {DELTA_SIGN[tone] && (
              <span aria-hidden className="mr-0.5">
                {DELTA_SIGN[tone]}
              </span>
            )}
            {delta}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-[11px] text-text-3">{hint}</div>}
    </div>
  );
}
