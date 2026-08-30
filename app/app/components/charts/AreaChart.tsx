/**
 * AreaChart — equity curve (DESIGN.md v2 §15, §17).
 * Pure SVG: subtle gradient fill (~14%) + 2px line (non-scaling-stroke),
 * implicit baseline, crosshair + tooltip on hover. Text always uses text
 * tokens (never a series color). Dark-first; SSR-safe (no window in render).
 */

import { useId, useState } from "react";

type Tone = "up" | "down" | "brand";

const TONE_VAR: Record<Tone, string> = {
  up: "var(--up)",
  down: "var(--down)",
  brand: "var(--brand)",
};

export interface AreaChartPoint {
  ts: string;
  value: number;
}

export interface AreaChartProps {
  points: AreaChartPoint[];
  tone?: Tone;
  height?: number;
}

function fmtValue(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000)
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (abs >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

const W = 600;
const PAD_TOP = 8;
const PAD_BOTTOM = 6;

export function AreaChart({ points, tone = "brand", height = 160 }: AreaChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId();
  const color = TONE_VAR[tone];

  if (!points || points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-[8px] border border-border bg-surface text-xs text-text-3"
        style={{ height }}
      >
        No equity data yet
      </div>
    );
  }

  const H = height;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = points.length;

  const xOf = (i: number) => (n > 1 ? (i / (n - 1)) * W : W / 2);
  const yOf = (v: number) =>
    PAD_TOP + (1 - (v - min) / span) * (H - PAD_TOP - PAD_BOTTOM);

  const linePts = points.map((p, i) => `${xOf(i)},${yOf(p.value)}`);
  const linePath = `M${linePts.join("L")}`;
  const baseline = H - PAD_BOTTOM;
  const areaPath = `${linePath}L${xOf(n - 1)},${baseline}L${xOf(0)},${baseline}Z`;

  const last = n - 1;
  const active = hover != null ? hover : null;

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Equity curve, ${n} points, from ${fmtValue(values[0])} to ${fmtValue(values[last])}`}
        style={{ display: "block", overflow: "visible" }}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width === 0) return;
          const frac = (e.clientX - rect.left) / rect.width;
          const idx = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
          setHover(idx);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {active != null && (
          <line
            x1={xOf(active)}
            y1={PAD_TOP}
            x2={xOf(active)}
            y2={baseline}
            stroke="var(--text-3)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* end marker + surface ring */}
        <circle
          cx={xOf(last)}
          cy={yOf(values[last])}
          r={4}
          fill={color}
          stroke="var(--surface)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {active != null && active !== last && (
          <circle
            cx={xOf(active)}
            cy={yOf(values[active])}
            r={4}
            fill={color}
            stroke="var(--surface)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {active != null && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-[6px] border border-border bg-surface-2 px-2 py-1 text-xs shadow-[0_4px_12px_rgba(0,0,0,0.32)]"
          style={{
            left: `${(xOf(active) / W) * 100}%`,
            top: `${(yOf(values[active]) / H) * 100}%`,
            transform: "translate(-50%, calc(-100% - 8px))",
          }}
        >
          <div className="text-text-3">{points[active].ts}</div>
          <div className="tnum font-semibold text-text">
            {fmtValue(values[active])}
          </div>
        </div>
      )}
    </div>
  );
}
