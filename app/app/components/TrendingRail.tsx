/**
 * TrendingRail — rail de demanda propia (plan §5.5 · DESIGN §24). `.glass-panel`,
 * sticky en desktop. Header: título + tabs (Más vistos / Más contratados) +
 * rango. Lista ordenada (<ol>) de TrendingRow. Estados honestos:
 *   - data === null  → EmptyState ("aún sin suficientes datos de demanda").
 *   - rows vacías    → EmptyState.
 * (El loading skeleton lo dispara el padre pasando data=null + loading; ver
 *  prop `loading`.) Prop-driven: NO llama al cliente de trending.
 * A11y: <ol>, tabs con role, Δ con signo+flecha (en TrendingRow).
 */

import type {
  TrendingMetric,
  TrendingResponse,
  TrendingWindow,
} from "../lib/contracts";
import { EmptyState } from "./EmptyState";
import { SkeletonRow } from "./Skeleton";
import { TrendingRow } from "./TrendingRow";

const METRIC_TABS: { value: TrendingMetric; label: string }[] = [
  { value: "views", label: "Más vistos" },
  { value: "hires", label: "Más contratados" },
];

const WINDOW_LABEL: Record<TrendingWindow, string> = {
  "1h": "1h",
  "24h": "24h",
  "7d": "7d",
};

export interface TrendingRailProps {
  data: TrendingResponse | null;
  metric: TrendingMetric;
  window: TrendingWindow;
  onMetricChange?: (m: TrendingMetric) => void;
  title?: string;
  /** Fuerza el estado de carga (8 filas shimmer). */
  loading?: boolean;
  className?: string;
}

export function TrendingRail({
  data,
  metric,
  window,
  onMetricChange,
  title = "Trending",
  loading = false,
  className = "",
}: TrendingRailProps) {
  const rows = data?.rows ?? [];

  return (
    <aside
      aria-label={`${title} por demanda`}
      className={`glass-panel flex flex-col gap-3 rounded-lg p-3 lg:sticky lg:top-24 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <span className="rounded-[999px] bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-text-3">
            {WINDOW_LABEL[window]}
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Métrica de demanda"
          className="glass-hair flex gap-0.5 rounded-[999px] p-0.5"
        >
          {METRIC_TABS.map((t) => {
            const active = t.value === metric;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={!onMetricChange || active}
                onClick={() => onMetricChange?.(t.value)}
                className={`flex-1 rounded-[999px] px-2 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-brand text-bg"
                    : "text-text-2 hover:text-text disabled:opacity-100"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cuerpo */}
      {loading ? (
        <div className="flex flex-col">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="◔"
          title="Aún sin suficientes datos de demanda"
          hint="El ranking aparece en cuanto haya vistas y contrataciones que contar en esta ventana."
        />
      ) : (
        <ol className="flex flex-col">
          {rows.map((row, i) => (
            <li key={row.agentId}>
              <TrendingRow rank={i + 1} row={row} metric={metric} />
            </li>
          ))}
        </ol>
      )}

      {data != null && rows.length > 0 && (
        <p className="px-2 text-[10px] text-text-3">
          Demanda propia (vistas + contrataciones) · fuente:{" "}
          <span className="font-medium">{data.source}</span>
        </p>
      )}
    </aside>
  );
}
