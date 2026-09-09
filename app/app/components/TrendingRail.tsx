/**
 * TrendingRail — first-party demand rail (plan §5.5 · DESIGN §24). `.glass-panel`,
 * sticky on desktop. Header: title + range badge. Below it, a tab strip that
 * switches between several ranked lists (e.g. Top / Trending / Most hired); the
 * rail owns the active-tab state, so switching is instant and client-side.
 *
 * Each tab carries its own `TrendingResponse`:
 *   - source "demand"     → first-party views/hires (real %change + sparkline).
 *   - source "reputation" → base ranking by a real on-chain metric (8004scan),
 *                           shown when demand is still thin so no tab is empty.
 * Honest empty state ("not enough data yet") only if a tab genuinely has no rows.
 * A11y: <ol>, tabs with role, Δ with sign+arrow (in TrendingRow).
 */

import { useState } from "react";
import type { TrendingResponse, TrendingWindow } from "../lib/contracts";
import { EmptyState } from "./EmptyState";
import { SkeletonRow } from "./Skeleton";
import { TrendingRow } from "./TrendingRow";

const WINDOW_LABEL: Record<TrendingWindow, string> = {
  "1h": "1h",
  "24h": "24h",
  "7d": "7d",
};

export interface TrendingTab {
  key: string;
  label: string;
  data: TrendingResponse | null;
}

export interface TrendingRailProps {
  tabs: TrendingTab[];
  title?: string;
  /** Forces the loading state (8 shimmer rows). */
  loading?: boolean;
  className?: string;
}

export function TrendingRail({
  tabs,
  title = "Trending",
  loading = false,
  className = "",
}: TrendingRailProps) {
  const [active, setActive] = useState(0);
  const current = tabs[active]?.data ?? null;
  const rows = current?.rows ?? [];

  // Range badge: reputation rankings aren't windowed, so they read "Top rated".
  const badge =
    current?.source === "reputation"
      ? "Top rated"
      : WINDOW_LABEL[current?.window ?? "24h"];

  return (
    <aside
      aria-label={`${title} by demand`}
      className={`glass-panel flex flex-col gap-3 self-start rounded-lg p-3 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <span className="rounded-[999px] bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-text-3">
            {badge}
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Ranking"
          className="glass-hair flex gap-0.5 rounded-[999px] p-0.5"
        >
          {tabs.map((t, i) => {
            const isActive = i === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(i)}
                className={`flex-1 rounded-[999px] px-2 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-brand text-bg"
                    : "text-text-2 hover:text-text"
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
          title="Not enough data yet"
          hint="This ranking appears as soon as there is data to count."
        />
      ) : (
        <ol className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
          {rows.map((row, i) => (
            <li key={row.agentId}>
              <TrendingRow
                rank={i + 1}
                row={row}
                metric={current?.metric ?? "views"}
                source={current?.source}
                basisLabel={current?.basisLabel}
              />
            </li>
          ))}
        </ol>
      )}

      {current != null && rows.length > 0 && (
        <p className="px-2 text-[10px] text-text-3">
          {current.source === "reputation" ? (
            <>
              Ranked by {current.basisLabel ?? "on-chain reputation"} · source:{" "}
              <span className="font-medium">8004scan</span>
            </>
          ) : (
            <>
              First-party demand (views + hires) · source:{" "}
              <span className="font-medium">{current.source}</span>
            </>
          )}
        </p>
      )}
    </aside>
  );
}
