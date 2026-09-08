/**
 * DashboardChart — the profile's headline panel (hiring-dashboard hero).
 *
 * A big chart with BOTTOM tabs (DESIGN.md §5, 2px --brand underline on active):
 *   1) Usage       — demand over time (views+hires, first-party) OR onchain
 *                    activity (trades binned by day). A small toggle switches
 *                    the source; each degrades to an honest empty state.
 *   2) Reputation  — real 8004scan score breakdown + review facts.
 *
 * Two floating KPI callouts (first two of getTrackRecord) sit above the chart.
 * Honesty (DESIGN.md §18): nothing is invented — empty series show a reason,
 * never a fabricated line.
 */

import { useMemo, useState } from "react";

import type { AgentDetail, UsageSeries } from "../../lib/contracts";
import { getTrackRecord } from "../../lib/profile";
import { AreaChart, type AreaChartPoint } from "../charts/AreaChart";
import { BarCompare } from "../charts/BarCompare";

type Tab = "usage" | "reputation";
type UsageSource = "demand" | "onchain";

function fmtHour(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    hour12: false,
  });
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Bin onchain trades by UTC day → one point per day (count of actions). */
function tradesByDay(detail: AgentDetail): AreaChartPoint[] {
  const trades = detail.trades?.trades ?? [];
  if (!trades.length) return [];
  const byDay = new Map<string, number>();
  for (const t of trades) {
    const d = new Date(t.ts);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  return [...byDay.entries()]
    .map(([key, value]) => {
      const [y, m, day] = key.split("-").map(Number);
      return { ts: fmtDay(new Date(Date.UTC(y, m - 1, day)).toISOString()), value };
    })
    .reverse(); // trades come newest-first; chart wants chronological
}

function Callout({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/80 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-text-3">{label}</div>
      <div className="tnum mt-1 text-2xl font-bold leading-none text-text">{value}</div>
      {hint && <div className="mt-1 text-[10px] text-text-3">{hint}</div>}
    </div>
  );
}

/** Honest empty state that still reads as "designed": a shimmer skeleton behind
 *  one clear line, instead of a blank void (DESIGN.md §18/§21 — no fake data). */
function Empty({
  children,
  height = 160,
  fill = false,
}: {
  children: React.ReactNode;
  height?: number;
  fill?: boolean;
}) {
  return (
    <div
      className={
        "relative flex items-center justify-center overflow-hidden rounded-[8px] border border-border/60 bg-surface/40 px-6 text-center " +
        (fill ? "h-full" : "")
      }
      style={fill ? undefined : { height }}
    >
      <div aria-hidden className="shimmer absolute inset-3 rounded-md opacity-25" />
      <p className="relative text-xs text-text-3">{children}</p>
    </div>
  );
}

export function DashboardChart({
  detail,
  usage,
  compact = false,
  only,
}: {
  detail: AgentDetail;
  usage: UsageSeries | null;
  /** Secondary/rail placement: drop the KPI callouts and shrink the plot. */
  compact?: boolean;
  /** Pin to a single chart (no tab switcher) — for stacking both side rails. */
  only?: Tab;
}) {
  const [tabState, setTab] = useState<Tab>(only ?? "usage");
  const [source, setSource] = useState<UsageSource>("demand");

  // When pinned, the active chart is fixed; otherwise the tab drives it.
  const tab = only ?? tabState;

  const kpis = getTrackRecord(detail).slice(0, 2);
  const chartH = compact ? 130 : 200;

  const demandPoints = useMemo<AreaChartPoint[]>(() => {
    const pts = usage?.points ?? [];
    return pts.map((p) => ({ ts: fmtHour(p.ts), value: p.views + p.hires }));
  }, [usage]);
  const demandTotal = demandPoints.reduce((s, p) => s + p.value, 0);

  const onchainPoints = useMemo(() => tradesByDay(detail), [detail]);

  const repBars = (detail.reputation?.dimensions ?? []).map((d) => ({
    label: d.key,
    value: Math.round(d.score),
  }));

  const tabs: { id: Tab; label: string }[] = [
    { id: "usage", label: "Usage" },
    { id: "reputation", label: "Reputation" },
  ];

  return (
    <div className={(compact ? "glass-hero p-4" : "glass-panel p-5") + " relative flex flex-col overflow-hidden rounded-xl" + (only ? " h-full" : "")}>
      {/* Floating KPI callouts (headline stats live elsewhere in compact rails) */}
      {!compact && (
        <div className="mb-4 flex flex-wrap gap-3">
          {kpis.map((k) => (
            <Callout key={k.label} label={k.label} value={k.value} hint={k.hint} />
          ))}
        </div>
      )}

      {/* Pinned single-chart heading (no tabs) — name what it shows. */}
      {only && (
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-3">
          {only === "usage" ? "Usage" : "Reputation"}
        </div>
      )}

      {/* Chart body — switches by tab. When pinned it becomes a flex column so
          the plot fills the panel's half of the rail. */}
      <div className={(compact ? "" : "min-h-[180px] ") + "flex min-h-0 flex-1 flex-col"}>
        {tab === "usage" ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs text-text-3">
                {source === "demand"
                  ? "Views + hires we count first-hand · analytics"
                  : "Onchain actions per day · indexer"}
              </div>
              {/* Demand · Onchain toggle */}
              <div className="glass-hair inline-flex rounded-[8px] p-0.5 text-xs font-semibold">
                {(["demand", "onchain"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSource(s)}
                    className={
                      "rounded-[6px] px-2.5 py-1 transition-colors " +
                      (source === s
                        ? "bg-surface-2 text-text"
                        : "text-text-3 hover:text-text-2")
                    }
                  >
                    {s === "demand" ? "Demand" : "Onchain"}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1">
              {source === "demand" ? (
                demandTotal > 0 ? (
                  <AreaChart points={demandPoints} tone="brand" height={chartH} fill={!!only} />
                ) : (
                  <Empty height={chartH} fill={!!only}>
                    No demand recorded yet — views and hires we count ourselves will
                    chart here as they accrue.
                  </Empty>
                )
              ) : onchainPoints.length ? (
                <AreaChart points={onchainPoints} tone="up" height={chartH} fill={!!only} />
              ) : (
                <Empty height={chartH} fill={!!only}>
                  No onchain actions indexed. The trades feed needs an indexer API
                  key — empty instead of made-up data.
                </Empty>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 text-xs text-text-3">
              Score breakdown · 8004scan reputation dimensions
            </div>
            {repBars.length ? (
              <div className={only ? "flex min-h-0 flex-1 items-center" : ""}>
                <BarCompare bars={repBars} unit="" />
              </div>
            ) : (
              <Empty height={chartH} fill={!!only}>
                No reputation dimensions available for this agent yet.
              </Empty>
            )}
          </>
        )}
      </div>

      {/* Bottom tabs (DESIGN.md §5) — hidden when pinned to a single chart. */}
      {!only && (
      <nav className="mt-4 flex gap-6 border-t border-border pt-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              "-mb-px border-b-2 pb-2 text-sm font-semibold transition-colors " +
              (tab === t.id
                ? "border-brand text-text"
                : "border-transparent text-text-2 hover:text-text")
            }
          >
            {t.label}
          </button>
        ))}
      </nav>
      )}
    </div>
  );
}
