/**
 * Donut — asset allocation (DESIGN.md v2 §15, §17).
 * SVG arcs (ring) with a 2px gap between slices; categorical colors
 * `--series-1..8` in FIXED ORDER (never cyclic), `--series-neutral` for
 * Cash/USDT/others. Normalizes to 100%. Legend on the right (label · % · value,
 * tabular) + tooltip per slice. Text with text tokens. SSR-safe.
 */

import { useState } from "react";

export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

export interface DonutProps {
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
}

const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];
const NEUTRAL = "var(--series-neutral)";
const NEUTRAL_LABELS = new Set(["cash", "usdt", "otros", "other", "others"]);

const CX = 60;
const CY = 60;
const R_OUT = 54;
const R_IN = 34;
const GAP = 2; // px of surface between slices

function fmtValue(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000)
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (abs >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

// angle 0 = top, clockwise.
function polar(r: number, a: number): [number, number] {
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
}

function ringPath(a0: number, a1: number): string {
  const [x0o, y0o] = polar(R_OUT, a0);
  const [x1o, y1o] = polar(R_OUT, a1);
  const [x1i, y1i] = polar(R_IN, a1);
  const [x0i, y0i] = polar(R_IN, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return (
    `M${x0o} ${y0o}` +
    `A${R_OUT} ${R_OUT} 0 ${large} 1 ${x1o} ${y1o}` +
    `L${x1i} ${y1i}` +
    `A${R_IN} ${R_IN} 0 ${large} 0 ${x0i} ${y0i}` +
    `Z`
  );
}

export function Donut({ slices, centerLabel, centerValue }: DonutProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const clean = (slices ?? []).filter((s) => s.value > 0);
  const total = clean.reduce((sum, s) => sum + s.value, 0);

  if (clean.length === 0 || total <= 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-[8px] border border-border bg-surface text-xs text-text-3">
        No allocation
      </div>
    );
  }

  // color per entity in fixed order; neutral does not consume a categorical index.
  let catIdx = 0;
  const colored = clean.map((s) => {
    const isNeutral = NEUTRAL_LABELS.has(s.label.trim().toLowerCase());
    let color = s.color;
    if (!color) {
      if (isNeutral) color = NEUTRAL;
      else color = SERIES[catIdx++ % SERIES.length];
    }
    const pct = (s.value / total) * 100;
    return { ...s, color, pct };
  });

  const gapAngle = GAP / R_OUT; // rad, approx 2px at the outer edge
  let cum = 0;
  const arcs = colored.map((s) => {
    const frac = s.value / total;
    const a0 = 2 * Math.PI * cum + gapAngle / 2;
    const a1 = 2 * Math.PI * (cum + frac) - gapAngle / 2;
    cum += frac;
    return { d: a1 > a0 ? ringPath(a0, a1) : "", ...s };
  });

  return (
    <div data-donut className="relative flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
        <svg
          viewBox="0 0 120 120"
          width="100%"
          height="100%"
          role="img"
          aria-label={`Allocation: ${colored
            .map((s) => `${s.label} ${s.pct.toFixed(0)}%`)
            .join(", ")}`}
          style={{ display: "block" }}
          onPointerLeave={() => setHover(null)}
        >
          {arcs.map((a, i) =>
            a.d ? (
              <path
                key={i}
                d={a.d}
                fill={a.color}
                opacity={hover == null || hover === i ? 1 : 0.82}
                style={{ transition: "opacity 120ms" }}
                onPointerMove={(e) => {
                  const host = (
                    e.currentTarget.closest("[data-donut]") as HTMLElement | null
                  )?.getBoundingClientRect();
                  if (host)
                    setPos({
                      x: e.clientX - host.left,
                      y: e.clientY - host.top,
                    });
                  setHover(i);
                }}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${a.label}: ${a.pct.toFixed(1)}% (${fmtValue(a.value)})`}
              />
            ) : null
          )}
        </svg>
        {(centerValue || centerLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue && (
              <div className="tnum text-lg font-semibold leading-tight text-text">
                {centerValue}
              </div>
            )}
            {centerLabel && (
              <div className="text-[11px] leading-tight text-text-3">
                {centerLabel}
              </div>
            )}
          </div>
        )}
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {colored.map((s, i) => (
          <li
            key={i}
            className="flex items-center gap-2 text-xs"
            onPointerMove={(e) => {
              const host = (
                e.currentTarget.closest("[data-donut]") as HTMLElement | null
              )?.getBoundingClientRect();
              if (host)
                setPos({ x: e.clientX - host.left, y: e.clientY - host.top });
              setHover(i);
            }}
            onPointerLeave={() => setHover(null)}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-text-2">
              {s.label}
            </span>
            <span className="tnum shrink-0 font-medium text-text">
              {s.pct.toFixed(1)}%
            </span>
            <span className="tnum shrink-0 text-text-3">{fmtValue(s.value)}</span>
          </li>
        ))}
      </ul>

      {hover != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-[6px] border border-border bg-surface-2 px-2 py-1 text-xs shadow-[0_4px_12px_rgba(0,0,0,0.32)]"
          style={{ left: pos.x, top: pos.y }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: colored[hover].color }}
              aria-hidden
            />
            <span className="text-text-3">{colored[hover].label}</span>
          </div>
          <div className="tnum font-semibold text-text">
            {fmtValue(colored[hover].value)} · {colored[hover].pct.toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}
