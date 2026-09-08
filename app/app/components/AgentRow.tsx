/**
 * AgentRow — dense list version of the agent (DESIGN.md v3 §5.7).
 *
 * Row toggled on by the chrome's grid/list switch. Columns: name + subcategory,
 * score (with tone), secondary metric (avg), demand (sparkline) and a "View" action.
 * Links to `/agent/:id`. SSR-safe (no effects). Real data from 8004scan.
 */

import { Link } from "react-router";
import type { Agent } from "../lib/agents";
import { agentHref } from "../lib/agents";
import { categoryOf } from "../lib/taxonomy";
import { CATEGORIES } from "../lib/taxonomy";
import { scoreTone } from "../lib/score";
import { Sparkline } from "./charts/Sparkline";

const TONE_TEXT: Record<"up" | "brand" | "down", string> = {
  up: "text-up",
  brand: "text-brand",
  down: "text-down",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function AgentRow({
  agent,
  demandSpark,
}: {
  agent: Agent;
  demandSpark?: number[];
}) {
  const tone = scoreTone(agent.score);
  const category = agent.subcategory ? categoryOf(agent.subcategory) : null;
  const accent = CATEGORIES.find((a) => a.id === category)?.accent ?? "var(--brand)";

  return (
    <Link
      to={agentHref(agent)}
      className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-border/60 bg-surface px-4 py-3 transition-colors hover:border-brand/50 hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_72px_72px_100px_64px]"
    >
      {/* Name + subcategory. */}
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-bold text-text-2"
          style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 40%, transparent)` }}
        >
          {initials(agent.name)}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-text">
              {agent.name}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-3">
            <span className="truncate">{agent.subcategoryLabel ?? "—"}</span>
          </div>
        </div>
      </div>

      {/* Score. */}
      <div className="hidden text-right sm:block">
        <div className="text-[10px] uppercase tracking-wide text-text-3">Score</div>
        <div className={`tnum text-sm font-semibold ${TONE_TEXT[tone]}`}>
          {agent.score}
        </div>
      </div>

      {/* Avg (secondary metric). */}
      <div className="hidden text-right sm:block">
        <div className="text-[10px] uppercase tracking-wide text-text-3">Avg</div>
        <div className="tnum text-sm font-semibold text-text">
          {agent.avgScore ? agent.avgScore.toFixed(1) : "—"}
        </div>
      </div>

      {/* Demand. */}
      <div className="hidden justify-self-end sm:block">
        {demandSpark && demandSpark.length > 0 ? (
          <Sparkline values={demandSpark} tone="brand" width={90} height={26} />
        ) : (
          <span className="text-[11px] text-text-3">—</span>
        )}
      </div>

      {/* Action. */}
      <span className="justify-self-end text-sm font-semibold text-text-2 transition-colors group-hover:text-brand">
        View →
      </span>
    </Link>
  );
}
