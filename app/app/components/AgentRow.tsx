/**
 * AgentRow — versión lista densa del agente (DESIGN.md v3 §5.7).
 *
 * Fila activada por el toggle grid/list del chrome. Columnas: nombre + categoría,
 * score (con tono), métrica secundaria (avg), demanda (sparkline) y acción "Ver".
 * Enlaza a `/agent/:id`. SSR-safe (sin efectos). Datos reales de 8004scan.
 */

import { Link } from "react-router";
import type { Agent } from "../lib/agents";
import { aisleOf } from "../lib/taxonomy";
import { AISLES } from "../lib/taxonomy";
import { ivlScoreTone } from "../lib/ivl";
import { Sparkline } from "./charts/Sparkline";
import { SourceBadge } from "./Badge";

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
  const tone = ivlScoreTone(agent.score);
  const aisle = agent.category ? aisleOf(agent.category) : null;
  const accent = AISLES.find((a) => a.id === aisle)?.accent ?? "var(--brand)";
  const isLive = agent.source === "8004scan";

  return (
    <Link
      to={`/agent/${encodeURIComponent(agent.id)}`}
      className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-border/60 bg-surface px-4 py-3 transition-colors hover:border-brand/50 hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_72px_72px_100px_64px]"
    >
      {/* Nombre + categoría. */}
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
            {isLive && (
              <span className="live-dot inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-up text-up" />
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-3">
            <span className="truncate">{agent.categoryLabel ?? "—"}</span>
            <SourceBadge source={agent.source} />
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

      {/* Avg (métrica secundaria). */}
      <div className="hidden text-right sm:block">
        <div className="text-[10px] uppercase tracking-wide text-text-3">Avg</div>
        <div className="tnum text-sm font-semibold text-text">
          {agent.avgScore ? agent.avgScore.toFixed(1) : "—"}
        </div>
      </div>

      {/* Demanda. */}
      <div className="hidden justify-self-end sm:block">
        {demandSpark && demandSpark.length > 0 ? (
          <Sparkline values={demandSpark} tone="brand" width={90} height={26} />
        ) : (
          <span className="text-[11px] text-text-3">—</span>
        )}
      </div>

      {/* Acción. */}
      <span className="justify-self-end text-sm font-semibold text-text-2 transition-colors group-hover:text-brand">
        Ver →
      </span>
    </Link>
  );
}
