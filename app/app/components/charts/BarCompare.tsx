/**
 * BarCompare — APY por protocolo (DESIGN.md v2 §15, plantilla `yield`).
 * Barras horizontales SVG, extremo de dato redondeado 4px anclado a baseline
 * (cuadrado a la izquierda), gap ≥2px entre barras. La barra `highlight` usa
 * `--brand` (énfasis escaso); el resto `--series-1` (misma medida = una serie).
 * Etiqueta de valor directa en la punta; texto con tokens de texto. Tooltip por
 * barra. Escala uniforme → esquinas circulares y texto nítido. SSR-safe.
 */

import { useState } from "react";

export interface BarCompareItem {
  label: string;
  value: number;
  highlight?: boolean;
}

export interface BarCompareProps {
  bars: BarCompareItem[];
  unit?: string;
}

const VBW = 320;
const ROW_H = 30;
const BAR_H = 14;
const GUTTER = 96; // etiqueta de categoría
const RIGHT = 44; // reserva para etiqueta de valor
const PAD_TOP = 4;

function fmtValue(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000)
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (abs >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

// rect con esquinas derechas redondeadas (r) y lado izquierdo cuadrado (baseline).
function roundedRightRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): string {
  const rr = Math.max(0, Math.min(r, w, h / 2));
  return (
    `M${x} ${y}` +
    `H${x + w - rr}` +
    `Q${x + w} ${y} ${x + w} ${y + rr}` +
    `V${y + h - rr}` +
    `Q${x + w} ${y + h} ${x + w - rr} ${y + h}` +
    `H${x}` +
    `Z`
  );
}

export function BarCompare({ bars, unit }: BarCompareProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  if (!bars || bars.length === 0) {
    return (
      <div className="flex h-[90px] items-center justify-center rounded-[8px] border border-border bg-surface text-xs text-text-3">
        Sin datos
      </div>
    );
  }

  const max = Math.max(...bars.map((b) => (b.value > 0 ? b.value : 0)), 0);
  const trackMax = VBW - GUTTER - RIGHT;
  const totalH = bars.length * ROW_H + PAD_TOP * 2;
  const suffix = unit ? ` ${unit}` : "";

  return (
    <div data-barcompare className="relative w-full">
      <svg
        viewBox={`0 0 ${VBW} ${totalH}`}
        width="100%"
        height="auto"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Comparativa: ${bars
          .map((b) => `${b.label} ${fmtValue(b.value)}${suffix}`)
          .join(", ")}`}
        style={{ display: "block" }}
        onPointerLeave={() => setHover(null)}
      >
        {bars.map((b, i) => {
          const y = PAD_TOP + i * ROW_H;
          const barY = y + (ROW_H - BAR_H) / 2;
          const w = max > 0 ? Math.max((b.value / max) * trackMax, b.value > 0 ? 2 : 0) : 0;
          const color = b.highlight ? "var(--brand)" : "var(--series-1)";
          const dim = hover != null && hover !== i ? 0.72 : 1;
          return (
            <g key={i} opacity={dim} style={{ transition: "opacity 120ms" }}>
              <text
                x={GUTTER - 6}
                y={barY + BAR_H / 2}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={11}
                fill="var(--text-2)"
              >
                {b.label}
              </text>
              {w > 0 && (
                <path d={roundedRightRect(GUTTER, barY, w, BAR_H, 4)} fill={color} />
              )}
              <text
                x={GUTTER + w + 6}
                y={barY + BAR_H / 2}
                dominantBaseline="central"
                fontSize={11}
                fill="var(--text)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {fmtValue(b.value)}
                {suffix}
              </text>
              {/* hit target de fila */}
              <rect
                x={0}
                y={y}
                width={VBW}
                height={ROW_H}
                fill="transparent"
                onPointerMove={(e) => {
                  const host = (
                    e.currentTarget.closest(
                      "[data-barcompare]"
                    ) as HTMLElement | null
                  )?.getBoundingClientRect();
                  if (host)
                    setPos({ x: e.clientX - host.left, y: e.clientY - host.top });
                  setHover(i);
                }}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${b.label}: ${fmtValue(b.value)}${suffix}`}
              />
            </g>
          );
        })}
      </svg>

      {hover != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-[6px] border border-border bg-surface-2 px-2 py-1 text-xs shadow-[0_4px_12px_rgba(0,0,0,0.32)]"
          style={{ left: pos.x, top: pos.y }}
        >
          <div className="text-text-3">{bars[hover].label}</div>
          <div className="tnum font-semibold text-text">
            {fmtValue(bars[hover].value)}
            {suffix}
          </div>
        </div>
      )}
    </div>
  );
}
