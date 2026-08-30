/**
 * Sparkline — mini trend line without axes (DESIGN.md v2 §15).
 * Compact glyph for KPI tiles: 2px line (non-scaling-stroke) + end-dot.
 * Valid hover exception (stat-tile without a plot); SSR-safe.
 */

import { useId } from "react";

type Tone = "up" | "down" | "brand";

const TONE_VAR: Record<Tone, string> = {
  up: "var(--up)",
  down: "var(--down)",
  brand: "var(--brand)",
};

export interface SparklineProps {
  values: number[];
  tone?: Tone;
  width?: number;
  height?: number;
}

export function Sparkline({
  values,
  tone = "brand",
  width = 96,
  height = 28,
}: SparklineProps) {
  const gradId = useId();
  const color = TONE_VAR[tone];
  const pad = 3;

  if (!values || values.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label="No data"
        style={{ display: "block" }}
      >
        <line
          x1={pad}
          y1={height / 2}
          x2={width - pad}
          y2={height / 2}
          stroke="var(--border)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = values.length;

  const xOf = (i: number) =>
    n > 1 ? pad + (i / (n - 1)) * (width - pad * 2) : width / 2;
  const yOf = (v: number) =>
    pad + (1 - (v - min) / span) * (height - pad * 2);

  const pts = values.map((v, i) => `${xOf(i)},${yOf(v)}`);
  const linePath = `M${pts.join("L")}`;
  const last = n - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Trend of ${n} points`}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={`${linePath}L${xOf(last)},${height - pad}L${xOf(0)},${height - pad}Z`}
        fill={`url(#${gradId})`}
        stroke="none"
      />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={xOf(last)} cy={yOf(values[last])} r={2.5} fill={color} />
    </svg>
  );
}
