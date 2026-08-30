/**
 * TrendingRail — first-party demand rail (plan §5.5 · DESIGN §24). `.glass-panel`,
 * sticky on desktop. Header: title + tabs (Most viewed / Most hired) +
 * range. Ordered list (<ol>) of TrendingRow. Honest states:
 *   - data === null  → EmptyState ("not enough demand data yet").
 *   - empty rows     → EmptyState.
 * (The loading skeleton is triggered by the parent passing data=null + loading; see
 *  the `loading` prop.) Prop-driven: does NOT call the trending client.
 * A11y: <ol>, tabs with role, Δ with sign+arrow (in TrendingRow).
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
  { value: "views", label: "Most viewed" },
  { value: "hires", label: "Most hired" },
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
  /** Forces the loading state (8 shimmer rows). */
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
      aria-label={`${title} by demand`}
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
          aria-label="Demand metric"
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

      {/* Body */}
      {loading ? (
        <div className="flex flex-col">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="◔"
          title="Not enough demand data yet"
          hint="The ranking appears as soon as there are views and hires to count in this window."
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
          First-party demand (views + hires) · source:{" "}
          <span className="font-medium">{data.source}</span>
        </p>
      )}
    </aside>
  );
}
