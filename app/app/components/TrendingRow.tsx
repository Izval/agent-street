/**
 * TrendingRow — demand row (plan §5.5). `#rank` · avatar/glyph · name +
 * verified · tabular metric · Δ% with sign+arrow (green/red, "new" if
 * null) · Sparkline. A11y: Δ does not depend on color alone (it carries a sign and arrow);
 * the row is a Link. Hover highlights the row.
 */

import { Link } from "react-router";
import type {
  TrendingMetric,
  TrendingResponse,
  TrendingRow as TrendingRowData,
} from "../lib/contracts";
import { Avatar } from "./Avatar";
import { agentHref } from "../lib/agents";
import { Sparkline } from "./charts/Sparkline";

export interface TrendingRowProps {
  rank: number;
  row: TrendingRowData;
  metric: TrendingMetric;
  /** "demand" shows the sparkline + Δ; "reputation" shows the on-chain metric. */
  source?: TrendingResponse["source"];
  /** For "reputation" rows: the on-chain metric label (e.g. "on-chain score", "reviews"). */
  basisLabel?: string;
}

const fmtCount = (v: number) =>
  v >= 1000 ? `${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k` : String(v);

function DeltaBadge({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct == null) {
    return (
      <span className="rounded-[999px] bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-3">
        new
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

export function TrendingRow({
  rank,
  row,
  metric,
  source = "demand",
  basisLabel,
}: TrendingRowProps) {
  const reputation = source === "reputation";
  const metricNoun = metric === "hires" ? "hires" : "views";
  const sparkTone = row.deltaPct == null ? "brand" : row.deltaPct >= 0 ? "up" : "down";

  return (
    <Link
      to={agentHref({ id: row.agentId, name: row.name })}
      className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-2"
    >
      <span className="tnum w-5 shrink-0 text-right text-xs font-semibold text-text-3">
        {rank}
      </span>

      <Avatar src={row.imageUrl} name={row.name} seed={row.agentId} />

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1 truncate text-sm font-medium text-text">
          <span className="truncate">{row.name}</span>
          {row.verified && (
            <span className="text-focus" aria-label="Verified" title="Verified">
              ✓
            </span>
          )}
        </span>
        <span className="tnum text-[11px] text-text-3">
          {reputation
            ? (basisLabel ?? "on-chain score")
            : `${fmtCount(row.count)} ${metricNoun}`}
        </span>
      </span>

      {reputation ? (
        <span className="tnum shrink-0 rounded-[999px] bg-surface-2 px-2 py-0.5 text-xs font-semibold text-text-2">
          {row.count}
        </span>
      ) : (
        <>
          <span className="hidden shrink-0 sm:block">
            <Sparkline values={row.spark} tone={sparkTone} width={64} height={22} />
          </span>

          <span className="w-16 shrink-0 text-right">
            <DeltaBadge deltaPct={row.deltaPct} />
          </span>
        </>
      )}

      <span
        aria-hidden
        className="w-2 shrink-0 text-text-3 opacity-0 transition-opacity group-hover:opacity-100"
      >
        ›
      </span>
    </Link>
  );
}
