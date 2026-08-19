/**
 * KpiTile — tile de KPI para el dashboard de detalle (DESIGN.md v2 §17.2).
 * Valor grande con numerales tabulares; delta con signo y color up/down
 * (verde/rojo SOLO para datos, §2.3); `hint` en --text-3 ("since indexed").
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
  /** Cambio ya formateado, p.ej. "12.4%" o "+1.2". El signo/flecha lo pone el tono. */
  delta?: string;
  tone?: Tone;
  /** Nota de procedencia del dato, p.ej. "since indexed". */
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
