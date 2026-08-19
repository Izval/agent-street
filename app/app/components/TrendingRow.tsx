/**
 * TrendingRow — fila de demanda (plan §5.5). `#rank` · avatar/glyph · nombre +
 * verificado · métrica tabular · Δ% con signo+flecha (verde/rojo, "nuevo" si
 * null) · Sparkline. A11y: Δ no depende solo del color (lleva signo y flecha);
 * la fila es un Link. Hover resalta la fila.
 */

import { Link } from "react-router";
import type { TrendingMetric, TrendingRow as TrendingRowData } from "../lib/contracts";
import { Sparkline } from "./charts/Sparkline";

export interface TrendingRowProps {
  rank: number;
  row: TrendingRowData;
  metric: TrendingMetric;
}

const fmtCount = (v: number) =>
  v >= 1000 ? `${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k` : String(v);

function DeltaBadge({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct == null) {
    return (
      <span className="rounded-[999px] bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-3">
        nuevo
      </span>
    );
  }
  const up = deltaPct >= 0;
  const tone = up ? "text-up" : "text-down";
  const arrow = up ? "▲" : "▼";
  const sign = up ? "+" : "−";
  const abs = Math.abs(deltaPct).toLocaleString("en-US", { maximumFractionDigits: 1 });
  return (
    <span className={`tnum inline-flex items-center gap-0.5 text-xs font-semibold ${tone}`}>
      <span aria-hidden>{arrow}</span>
      {sign}
      {abs}%
    </span>
  );
}

export function TrendingRow({ rank, row, metric }: TrendingRowProps) {
  const initial = row.name.trim().charAt(0).toUpperCase() || "?";
  const metricNoun = metric === "hires" ? "contrataciones" : "vistas";
  const sparkTone = row.deltaPct == null ? "brand" : row.deltaPct >= 0 ? "up" : "down";

  return (
    <Link
      to={`/agent/${row.agentId}`}
      className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-2"
    >
      <span className="tnum w-5 shrink-0 text-right text-xs font-semibold text-text-3">
        {rank}
      </span>

      {row.imageUrl ? (
        <img
          src={row.imageUrl}
          alt=""
          className="h-7 w-7 shrink-0 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-text-2"
        >
          {initial}
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1 truncate text-sm font-medium text-text">
          <span className="truncate">{row.name}</span>
          <span className="text-focus" aria-label="Verificado" title="Verificado">
            ✓
          </span>
        </span>
        <span className="tnum text-[11px] text-text-3">
          {fmtCount(row.count)} {metricNoun}
        </span>
      </span>

      <span className="hidden shrink-0 sm:block">
        <Sparkline values={row.spark} tone={sparkTone} width={64} height={22} />
      </span>

      <span className="w-16 shrink-0 text-right">
        <DeltaBadge deltaPct={row.deltaPct} />
      </span>

      <span
        aria-hidden
        className="w-2 shrink-0 text-text-3 opacity-0 transition-opacity group-hover:opacity-100"
      >
        ›
      </span>
    </Link>
  );
}
